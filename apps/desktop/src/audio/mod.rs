use rodio::{
    Decoder, OutputStreamBuilder, Sink, Source,
    mixer::{Mixer, mixer},
    source::{SeekError, Zero},
};
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::File,
    io::BufReader,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU32, Ordering},
        mpsc::{self, Sender},
    },
    thread,
    time::Duration,
};

pub mod commands;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum DeckId {
    Left,
    Right,
}

#[derive(Clone, Copy)]
pub enum DeckAction {
    Play,
    Pause,
    Stop,
    Restart,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckMeter {
    pub position_ms: u64,
    pub peak: f32,
    pub clipping: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSfx {
    pub id: String,
    pub count: usize,
    pub progress: f32,
}

struct MeterCell {
    peak: AtomicU32,
}

impl MeterCell {
    fn new() -> Self {
        Self {
            peak: AtomicU32::new(0.0f32.to_bits()),
        }
    }

    fn read(&self) -> f32 {
        f32::from_bits(self.peak.load(Ordering::Relaxed))
    }
}

struct Deck {
    sink: Sink,
    path: PathBuf,
    volume: f32,
    fade_gain: f32,
    looping: bool,
    duration: Duration,
    position_offset: Duration,
    meter: Arc<MeterCell>,
}

impl Deck {
    fn position(&self) -> Duration {
        let position = self.position_offset.saturating_add(self.sink.get_pos());
        if self.looping && !self.duration.is_zero() {
            let wrapped = position.as_nanos() % self.duration.as_nanos();
            Duration::new(
                (wrapped / 1_000_000_000) as u64,
                (wrapped % 1_000_000_000) as u32,
            )
        } else {
            position.min(self.duration)
        }
    }
}

struct RegisteredSfx {
    path: PathBuf,
    volume: f32,
    duration: Duration,
    channels: u16,
    sample_rate: u32,
    samples: Option<Arc<[f32]>>,
}

struct PlayingSfx {
    id: String,
    sink: Sink,
    duration: Duration,
}

enum Command {
    Load(DeckId, PathBuf, Sender<Result<(), String>>),
    Clear(DeckId),
    Control(DeckId, DeckAction, Sender<Result<(), String>>),
    Volume(DeckId, f32),
    FadeGain(DeckId, f32, Sender<Result<(), String>>),
    Crossfade(f32),
    Loop(DeckId, bool),
    Seek(DeckId, u64, Sender<Result<(), String>>),
    Meter(DeckId, Sender<DeckMeter>),
    AddSfx(String, PathBuf, f32, Sender<Result<(), String>>),
    SfxVolume(String, f32, Sender<Result<(), String>>),
    RemoveSfx(String),
    PlaySfx(String, Sender<Result<(), String>>),
    ActiveSfx(Sender<Vec<ActiveSfx>>),
    StopSfx,
    Finished(DeckId, Sender<bool>),
}

#[derive(Clone)]
pub struct AudioService {
    tx: Sender<Command>,
    unavailable: Option<Arc<String>>,
}

impl AudioService {
    pub fn new() -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::channel();
        thread::Builder::new()
            .name("djmesrc-audio".into())
            .spawn(move || {
                let stream = match OutputStreamBuilder::open_default_stream() {
                    Ok(value) => value,
                    Err(error) => {
                        let _ = ready_tx.send(Err(error.to_string()));
                        return;
                    }
                };
                let channels = stream.config().channel_count();
                let sample_rate = stream.config().sample_rate();
                let (bus, bus_source) = mixer(channels, sample_rate);
                // Keep the shared bus alive while no deck or effect is playing.
                bus.add(Zero::new(channels, sample_rate));
                let limiter_active = Arc::new(AtomicBool::new(false));
                let master_sink = Sink::connect_new(stream.mixer());
                master_sink.append(MasterLimiter::new(bus_source, limiter_active.clone()));
                master_sink.play();
                let _ = ready_tx.send(Ok(()));

                let mut decks: HashMap<DeckId, Deck> = HashMap::new();
                let mut effects: HashMap<String, RegisteredSfx> = HashMap::new();
                let mut playing_sfx: Vec<PlayingSfx> = Vec::new();
                let mut crossfade = 0.5f32;

                loop {
                    let command = match rx.recv_timeout(Duration::from_millis(25)) {
                        Ok(command) => Some(command),
                        Err(mpsc::RecvTimeoutError::Timeout) => None,
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    };

                    if let Some(command) = command {
                        match command {
                            Command::Load(id, path, reply) => {
                                let result = open_decoder(&path).map(|decoder| {
                                    let duration = decoder.total_duration().unwrap_or_default();
                                    if let Some(previous) = decks.get(&id) {
                                        previous.sink.stop();
                                    }
                                    let meter = Arc::new(MeterCell::new());
                                    let sink = Sink::connect_new(&bus);
                                    sink.append(MeteredSource::new(decoder, meter.clone()));
                                    sink.pause();
                                    let volume =
                                        decks.get(&id).map(|deck| deck.volume).unwrap_or(0.72);
                                    sink.set_volume(volume);
                                    decks.insert(
                                        id,
                                        Deck {
                                            sink,
                                            path,
                                            volume,
                                            fade_gain: 1.0,
                                            looping: false,
                                            duration,
                                            position_offset: Duration::ZERO,
                                            meter,
                                        },
                                    );
                                });
                                let _ = reply.send(result);
                            }
                            Command::Clear(id) => {
                                if let Some(deck) = decks.remove(&id) {
                                    deck.sink.stop();
                                }
                            }
                            Command::Control(id, action, reply) => {
                                let result = if let Some(deck) = decks.get_mut(&id) {
                                    match action {
                                        DeckAction::Play => {
                                            deck.sink.play();
                                            Ok(())
                                        }
                                        DeckAction::Pause => {
                                            deck.sink.pause();
                                            Ok(())
                                        }
                                        DeckAction::Stop => {
                                            match make_deck_sink_at(
                                                &bus,
                                                &deck.path,
                                                deck.looping,
                                                deck.meter.clone(),
                                                None,
                                            ) {
                                                Ok(next) => {
                                                    next.set_volume(
                                                        deck.volume
                                                            * deck.fade_gain
                                                            * crossfade_gain(id, crossfade)
                                                            * sfx_duck(&playing_sfx),
                                                    );
                                                    deck.sink.stop();
                                                    next.pause();
                                                    deck.sink = next;
                                                    deck.position_offset = Duration::ZERO;
                                                    Ok(())
                                                }
                                                Err(error) => {
                                                    deck.sink.stop();
                                                    Err(error)
                                                }
                                            }
                                        }
                                        DeckAction::Restart => {
                                            match make_deck_sink_at(
                                                &bus,
                                                &deck.path,
                                                deck.looping,
                                                deck.meter.clone(),
                                                None,
                                            ) {
                                                Ok(next) => {
                                                    next.set_volume(
                                                        deck.volume
                                                            * deck.fade_gain
                                                            * crossfade_gain(id, crossfade)
                                                            * sfx_duck(&playing_sfx),
                                                    );
                                                    deck.sink.stop();
                                                    deck.sink = next;
                                                    deck.position_offset = Duration::ZERO;
                                                    deck.sink.play();
                                                    Ok(())
                                                }
                                                Err(error) => {
                                                    deck.sink.stop();
                                                    Err(error)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    Err("No track is loaded on this deck".into())
                                };
                                let _ = reply.send(result);
                            }
                            Command::Volume(id, volume) => {
                                if let Some(deck) = decks.get_mut(&id) {
                                    deck.volume = volume.clamp(0.0, 1.0);
                                }
                            }
                            Command::FadeGain(id, gain, reply) => {
                                let result = if let Some(deck) = decks.get_mut(&id) {
                                    deck.fade_gain = gain.clamp(0.0, 1.0);
                                    Ok(())
                                } else {
                                    Err("No track is loaded on this deck".into())
                                };
                                let _ = reply.send(result);
                            }
                            Command::Crossfade(value) => crossfade = value.clamp(0.0, 1.0),
                            Command::Loop(id, enabled) => {
                                if let Some(deck) = decks.get_mut(&id) {
                                    let was_playing = !deck.sink.is_paused();
                                    let position = deck.position();
                                    if let Ok(next) = make_deck_sink_at(
                                        &bus,
                                        &deck.path,
                                        enabled,
                                        deck.meter.clone(),
                                        Some(position),
                                    ) {
                                        next.set_volume(
                                            deck.volume
                                                * deck.fade_gain
                                                * crossfade_gain(id, crossfade)
                                                * sfx_duck(&playing_sfx),
                                        );
                                        deck.sink.stop();
                                        deck.sink = next;
                                        deck.looping = enabled;
                                        deck.position_offset = position;
                                        if was_playing {
                                            deck.sink.play();
                                        } else {
                                            deck.sink.pause();
                                        }
                                    }
                                }
                            }
                            Command::Seek(id, position_ms, reply) => {
                                let result = if let Some(deck) = decks.get_mut(&id) {
                                    let was_playing = !deck.sink.is_paused();
                                    let next = make_deck_sink_at(
                                        &bus,
                                        &deck.path,
                                        deck.looping,
                                        deck.meter.clone(),
                                        Some(Duration::from_millis(position_ms)),
                                    );
                                    match next {
                                        Ok(next) => {
                                            next.set_volume(
                                                deck.volume
                                                    * deck.fade_gain
                                                    * crossfade_gain(id, crossfade)
                                                    * sfx_duck(&playing_sfx),
                                            );
                                            deck.sink.stop();
                                            deck.sink = next;
                                            deck.position_offset =
                                                Duration::from_millis(position_ms)
                                                    .min(deck.duration);
                                            if was_playing {
                                                deck.sink.play();
                                            } else {
                                                deck.sink.pause();
                                            }
                                            Ok(())
                                        }
                                        Err(error) => Err(error),
                                    }
                                } else {
                                    Err("No track is loaded on this deck".into())
                                };
                                let _ = reply.send(result);
                            }
                            Command::Meter(id, reply) => {
                                let meter = decks
                                    .get(&id)
                                    .map(|deck| {
                                        let position = deck.position();
                                        let gain = deck.volume
                                            * deck.fade_gain
                                            * crossfade_gain(id, crossfade)
                                            * sfx_duck(&playing_sfx);
                                        let peak = if deck.sink.is_paused() {
                                            0.0
                                        } else {
                                            deck.meter.read() * gain
                                        };
                                        DeckMeter {
                                            position_ms: position.as_millis() as u64,
                                            peak: peak.min(1.0),
                                            clipping: peak >= 0.9
                                                || limiter_active.load(Ordering::Relaxed),
                                        }
                                    })
                                    .unwrap_or(DeckMeter {
                                        position_ms: 0,
                                        peak: 0.0,
                                        clipping: false,
                                    });
                                let _ = reply.send(meter);
                            }
                            Command::AddSfx(id, path, volume, reply) => {
                                let result = open_decoder(&path).and_then(|decoder| {
                                    let duration = decoder.total_duration().unwrap_or_default();
                                    let channels = decoder.channels();
                                    let sample_rate = decoder.sample_rate();
                                    let estimated_bytes = duration.as_secs_f64()
                                        * sample_rate as f64
                                        * channels as f64
                                        * std::mem::size_of::<f32>() as f64;
                                    let samples = if !duration.is_zero()
                                        && estimated_bytes <= 64.0 * 1024.0 * 1024.0
                                    {
                                        let decoded = decoder.collect::<Vec<f32>>();
                                        if decoded.is_empty() {
                                            return Err("Sound effect has no audio samples".into());
                                        }
                                        Some(Arc::<[f32]>::from(decoded))
                                    } else {
                                        None
                                    };
                                    effects.insert(
                                        id,
                                        RegisteredSfx {
                                            path,
                                            volume: volume.clamp(0.0, 1.0),
                                            duration,
                                            channels,
                                            sample_rate,
                                            samples,
                                        },
                                    );
                                    Ok(())
                                });
                                let _ = reply.send(result);
                            }
                            Command::SfxVolume(id, volume, reply) => {
                                if let Some(effect) = effects.get_mut(&id) {
                                    effect.volume = volume.clamp(0.0, 1.0);
                                    for instance in
                                        playing_sfx.iter().filter(|instance| instance.id == id)
                                    {
                                        instance.sink.set_volume(effect.volume);
                                    }
                                    let _ = reply.send(Ok(()));
                                } else {
                                    let _ =
                                        reply.send(Err("Sound effect is not registered".into()));
                                }
                            }
                            Command::RemoveSfx(id) => {
                                effects.remove(&id);
                                for instance in
                                    playing_sfx.iter().filter(|instance| instance.id == id)
                                {
                                    instance.sink.stop();
                                }
                            }
                            Command::PlaySfx(id, reply) => {
                                let result = if let Some(effect) = effects.get(&id) {
                                    let source: Result<Box<dyn Source<Item = f32> + Send>, String> =
                                        match &effect.samples {
                                            Some(samples) => Ok(Box::new(SharedSamples::new(
                                                samples.clone(),
                                                effect.channels,
                                                effect.sample_rate,
                                            ))),
                                            None => open_decoder(&effect.path).map(|decoder| {
                                                Box::new(decoder)
                                                    as Box<dyn Source<Item = f32> + Send>
                                            }),
                                        };
                                    source.map(|source| {
                                        let sink = Sink::connect_new(&bus);
                                        sink.set_volume(effect.volume);
                                        sink.append(source);
                                        playing_sfx.push(PlayingSfx {
                                            id,
                                            sink,
                                            duration: effect.duration,
                                        });
                                    })
                                } else {
                                    Err("Sound effect is not registered".into())
                                };
                                let _ = reply.send(result);
                            }
                            Command::ActiveSfx(reply) => {
                                let mut states: HashMap<String, ActiveSfx> = HashMap::new();
                                for instance in &playing_sfx {
                                    let progress = if instance.duration.is_zero() {
                                        0.0
                                    } else {
                                        (instance.sink.get_pos().as_secs_f32()
                                            / instance.duration.as_secs_f32())
                                        .clamp(0.0, 1.0)
                                    };
                                    let state =
                                        states.entry(instance.id.clone()).or_insert(ActiveSfx {
                                            id: instance.id.clone(),
                                            count: 0,
                                            progress,
                                        });
                                    state.count += 1;
                                    state.progress = state.progress.max(progress);
                                }
                                let _ = reply.send(states.into_values().collect());
                            }
                            Command::StopSfx => {
                                for instance in playing_sfx.drain(..) {
                                    instance.sink.stop();
                                }
                            }
                            Command::Finished(id, reply) => {
                                let finished =
                                    decks.get(&id).map(|deck| deck.sink.empty()).unwrap_or(true);
                                let _ = reply.send(finished);
                            }
                        }
                    }

                    playing_sfx.retain(|instance| !instance.sink.empty());
                    let duck = sfx_duck(&playing_sfx);
                    for (id, deck) in &decks {
                        deck.sink.set_volume(
                            deck.volume * deck.fade_gain * crossfade_gain(*id, crossfade) * duck,
                        );
                    }
                }
                master_sink.stop();
            })
            .map_err(|error| error.to_string())?;
        ready_rx.recv().map_err(|error| error.to_string())??;
        Ok(Self {
            tx,
            unavailable: None,
        })
    }

    pub fn offline(error: String) -> Self {
        let (tx, rx) = mpsc::channel();
        drop(rx);
        Self {
            tx,
            unavailable: Some(Arc::new(error)),
        }
    }

    pub fn status(&self) -> Result<(), String> {
        match &self.unavailable {
            Some(error) => Err(format!("Audio output is unavailable: {error}")),
            None => Ok(()),
        }
    }

    fn request(
        &self,
        make: impl FnOnce(Sender<Result<(), String>>) -> Command,
    ) -> Result<(), String> {
        self.status()?;
        let (tx, rx) = mpsc::channel();
        self.tx.send(make(tx)).map_err(|error| error.to_string())?;
        rx.recv().map_err(|error| error.to_string())?
    }

    pub fn load(&self, id: DeckId, path: PathBuf) -> Result<(), String> {
        self.request(|reply| Command::Load(id, path, reply))
    }
    pub fn clear(&self, id: DeckId) {
        let _ = self.tx.send(Command::Clear(id));
    }
    pub fn control(&self, id: DeckId, action: DeckAction) -> Result<(), String> {
        self.request(|reply| Command::Control(id, action, reply))
    }
    pub fn seek(&self, id: DeckId, position: u64) -> Result<(), String> {
        self.request(|reply| Command::Seek(id, position, reply))
    }
    pub fn meter(&self, id: DeckId) -> DeckMeter {
        if self.unavailable.is_some() {
            return DeckMeter {
                position_ms: 0,
                peak: 0.0,
                clipping: false,
            };
        }
        let (tx, rx) = mpsc::channel();
        if self.tx.send(Command::Meter(id, tx)).is_err() {
            return DeckMeter {
                position_ms: 0,
                peak: 0.0,
                clipping: false,
            };
        }
        rx.recv().unwrap_or(DeckMeter {
            position_ms: 0,
            peak: 0.0,
            clipping: false,
        })
    }
    pub fn volume(&self, id: DeckId, value: f32) {
        if self.unavailable.is_some() {
            return;
        }
        let _ = self.tx.send(Command::Volume(id, value));
    }
    pub fn fade_gain(&self, id: DeckId, value: f32) -> Result<(), String> {
        self.request(|reply| Command::FadeGain(id, value, reply))
    }
    pub fn crossfade(&self, value: f32) {
        if self.unavailable.is_some() {
            return;
        }
        let _ = self.tx.send(Command::Crossfade(value));
    }
    pub fn looping(&self, id: DeckId, value: bool) {
        if self.unavailable.is_some() {
            return;
        }
        let _ = self.tx.send(Command::Loop(id, value));
    }
    pub fn add_sfx(&self, id: String, path: PathBuf, volume: f32) -> Result<(), String> {
        self.request(|reply| Command::AddSfx(id, path, volume, reply))
    }
    pub fn sfx_volume(&self, id: String, value: f32) -> Result<(), String> {
        self.request(|reply| Command::SfxVolume(id, value, reply))
    }
    pub fn remove_sfx(&self, id: String) {
        if self.unavailable.is_some() {
            return;
        }
        let _ = self.tx.send(Command::RemoveSfx(id));
    }
    pub fn play_sfx(&self, id: String) -> Result<(), String> {
        self.request(|reply| Command::PlaySfx(id, reply))
    }
    pub fn active_sfx(&self) -> Vec<ActiveSfx> {
        if self.unavailable.is_some() {
            return Vec::new();
        }
        let (tx, rx) = mpsc::channel();
        if self.tx.send(Command::ActiveSfx(tx)).is_err() {
            return Vec::new();
        }
        rx.recv().unwrap_or_default()
    }
    pub fn stop_sfx(&self) {
        if self.unavailable.is_some() {
            return;
        }
        let _ = self.tx.send(Command::StopSfx);
    }
    pub fn finished(&self, id: DeckId) -> bool {
        if self.unavailable.is_some() {
            return true;
        }
        let (tx, rx) = mpsc::channel();
        if self.tx.send(Command::Finished(id, tx)).is_err() {
            return true;
        }
        rx.recv().unwrap_or(true)
    }
}

fn open_decoder(path: &PathBuf) -> Result<Decoder<BufReader<File>>, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    Decoder::try_from(file).map_err(|error| error.to_string())
}

fn make_deck_sink_at(
    bus: &Mixer,
    path: &PathBuf,
    looping: bool,
    meter: Arc<MeterCell>,
    position: Option<Duration>,
) -> Result<Sink, String> {
    let decoder = open_decoder(path)?;
    let sink = Sink::connect_new(bus);
    let decoder = match position {
        Some(position) => decoder.skip_duration(position),
        None => decoder.skip_duration(Duration::ZERO),
    };
    let source = MeteredSource::new(decoder, meter);
    if looping {
        sink.append(source.repeat_infinite());
    } else {
        sink.append(source);
    }
    Ok(sink)
}

fn crossfade_gain(id: DeckId, value: f32) -> f32 {
    match (id, value) {
        (DeckId::Left, x) if x > 0.5 => 2.0 * (1.0 - x),
        (DeckId::Right, x) if x < 0.5 => 2.0 * x,
        _ => 1.0,
    }
}

fn sfx_duck(playing: &[PlayingSfx]) -> f32 {
    if playing.is_empty() { 1.0 } else { 0.35 }
}

struct SharedSamples {
    samples: Arc<[f32]>,
    cursor: usize,
    channels: u16,
    sample_rate: u32,
}

impl SharedSamples {
    fn new(samples: Arc<[f32]>, channels: u16, sample_rate: u32) -> Self {
        Self {
            samples,
            cursor: 0,
            channels,
            sample_rate,
        }
    }
}

impl Iterator for SharedSamples {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.samples.get(self.cursor).copied()?;
        self.cursor += 1;
        Some(sample)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.samples.len().saturating_sub(self.cursor);
        (remaining, Some(remaining))
    }
}

impl Source for SharedSamples {
    fn current_span_len(&self) -> Option<usize> {
        Some(self.samples.len().saturating_sub(self.cursor))
    }
    fn channels(&self) -> u16 {
        self.channels
    }
    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    fn total_duration(&self) -> Option<Duration> {
        if self.channels == 0 || self.sample_rate == 0 {
            return Some(Duration::ZERO);
        }
        Some(Duration::from_secs_f64(
            self.samples.len() as f64 / self.channels as f64 / self.sample_rate as f64,
        ))
    }
    fn try_seek(&mut self, position: Duration) -> Result<(), SeekError> {
        let sample = position.as_secs_f64() * self.channels as f64 * self.sample_rate as f64;
        self.cursor = (sample as usize).min(self.samples.len());
        Ok(())
    }
}

struct MeteredSource<S> {
    input: S,
    meter: Arc<MeterCell>,
    window_peak: f32,
    sample_count: usize,
}

impl<S> MeteredSource<S> {
    fn new(input: S, meter: Arc<MeterCell>) -> Self {
        Self {
            input,
            meter,
            window_peak: 0.0,
            sample_count: 0,
        }
    }
}

impl<S: Source> Iterator for MeteredSource<S> {
    type Item = rodio::Sample;
    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.input.next()?;
        self.window_peak = self.window_peak.max(sample.abs());
        self.sample_count += 1;
        if self.sample_count >= 512 {
            self.meter
                .peak
                .store(self.window_peak.to_bits(), Ordering::Relaxed);
            self.sample_count = 0;
            self.window_peak = 0.0;
        }
        Some(sample)
    }
}

impl<S: Source> Source for MeteredSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.input.current_span_len()
    }
    fn channels(&self) -> u16 {
        self.input.channels()
    }
    fn sample_rate(&self) -> u32 {
        self.input.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.input.total_duration()
    }
    fn try_seek(&mut self, position: Duration) -> Result<(), SeekError> {
        self.input.try_seek(position)
    }
}

struct MasterLimiter<S> {
    input: S,
    limiter_active: Arc<AtomicBool>,
    block_active: bool,
    sample_count: usize,
}

impl<S> MasterLimiter<S> {
    fn new(input: S, limiter_active: Arc<AtomicBool>) -> Self {
        Self {
            input,
            limiter_active,
            block_active: false,
            sample_count: 0,
        }
    }
}

impl<S: Source> Iterator for MasterLimiter<S> {
    type Item = rodio::Sample;
    fn next(&mut self) -> Option<Self::Item> {
        self.input.next().map(|sample| {
            const THRESHOLD: f32 = 0.82;
            let magnitude = sample.abs();
            self.block_active |= magnitude > THRESHOLD;
            self.sample_count += 1;
            if self.sample_count >= 512 {
                self.limiter_active
                    .store(self.block_active, Ordering::Relaxed);
                self.block_active = false;
                self.sample_count = 0;
            }
            if magnitude > THRESHOLD {
                let compressed = 1.0 - (-(magnitude - THRESHOLD) / (1.0 - THRESHOLD)).exp();
                let limited = THRESHOLD + (1.0 - THRESHOLD) * compressed;
                sample.signum() * limited.min(1.0)
            } else {
                sample
            }
        })
    }
}

impl<S: Source> Source for MasterLimiter<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.input.current_span_len()
    }
    fn channels(&self) -> u16 {
        self.input.channels()
    }
    fn sample_rate(&self) -> u32 {
        self.input.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.input.total_duration()
    }
    fn try_seek(&mut self, position: Duration) -> Result<(), SeekError> {
        self.input.try_seek(position)
    }
}
