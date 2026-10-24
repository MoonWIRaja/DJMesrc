import "./styles.css";

const repository = "MoonWIRaja/DJMesrc";
const releaseApi = `https://api.github.com/repos/${repository}/releases/latest`;
const latestReleasePage = `https://github.com/${repository}/releases/latest`;
const fallbackTag = "v0.5.4";
const base = import.meta.env.BASE_URL;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="#top" aria-label="DJMesrc home">
      <img src="${base}djmesrc-icon.png" alt="" width="34" height="34" />
      <span>DJMesrc<small>EVENT AUDIO DESK</small></span>
    </a>
    <nav aria-label="Main navigation">
      <a href="#how-it-works">How it works</a>
      <a href="#features">Features</a>
      <a href="https://github.com/${repository}" target="_blank" rel="noreferrer">GitHub</a>
      <a class="nav-download" href="${latestReleasePage}" id="nav-download">Download</a>
    </nav>
  </header>

  <main id="top">
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">TWO DECKS. ONE CLEAR WORKSPACE.</p>
        <h1 id="hero-title">Event audio,<br /><span>made clear.</span></h1>
        <p class="hero-intro">Two music decks and a soundboard, organized for the people running your event.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="${latestReleasePage}" id="download-primary">Download</a>
          <a class="text-link" href="#how-it-works">See how it works <span aria-hidden="true">&#8595;</span></a>
        </div>
        <div class="release-line" aria-live="polite">
          <span class="release-dot" aria-hidden="true"></span>
          <span id="release-version">Latest release ${fallbackTag}</span>
          <span class="release-separator" aria-hidden="true">/</span>
          <span>Windows x64</span>
        </div>
        <p class="release-status" id="release-status">Opening the latest release on GitHub if the download link is unavailable.</p>
      </div>
      <figure class="hero-screen">
        <div class="screen-chrome"><img class="screen-app-icon" src="${base}djmesrc-icon.png" alt="" width="15" height="15" /><span>DJMesrc Desktop</span><span class="screen-state">TWO INDEPENDENT DECKS</span></div>
        <img src="${base}media/console-overview.png" width="1568" height="842" alt="DJMesrc with both music decks, queues and the sound effects board visible together" fetchpriority="high" />
        <figcaption>One workspace for music and cues.</figcaption>
      </figure>
    </section>

    <section class="role-band" aria-label="Deck assignment">
      <div class="wrap role-band-inner">
        <p>Give each deck a role that fits the event.</p>
        <span>Deck A <b>+</b> Deck B <b>+</b> Sound FX</span>
      </div>
    </section>

    <section class="how-section wrap" id="how-it-works" aria-labelledby="how-title">
      <div class="section-heading">
        <p class="eyebrow">A SHORT HANDOVER</p>
        <h2 id="how-title">Easy to pick up.<br />Easy to run.</h2>
        <p>Keep background music going, bring in an event track, then return to the room without learning a full DJ setup.</p>
      </div>
      <ol class="steps">
        <li><span class="step-number">01</span><div><h3>Add music</h3><p>Load tracks into Deck A, Deck B or both. The decks have no fixed music role.</p></div></li>
        <li><span class="step-number">02</span><div><h3>Set the queue</h3><p>Drag tracks to reorder. Select a queued track to play it now, or right-click for track actions.</p></div></li>
        <li><span class="step-number">03</span><div><h3>Move between decks</h3><p>Use the deck volume or center crossfader to bring one source forward and lower the other.</p></div></li>
        <li><span class="step-number">04</span><div><h3>Trigger a sound</h3><p>Play SFX when needed. Effects can overlap, and the music returns to its original level after the last one ends.</p></div></li>
      </ol>
    </section>

    <section class="feature-section wrap" id="features" aria-labelledby="feature-title">
      <div class="feature-copy">
        <p class="eyebrow">TWO DECKS, YOUR WAY</p>
        <h2 id="feature-title">Keep the room moving.</h2>
        <p>Run background music on one deck and an event track on the other, or assign the decks differently. Play, pause, seek and adjust each deck independently.</p>
        <ul class="feature-list">
          <li>Independent volume and mute</li>
          <li>Loop the current track or move through the queue</li>
          <li>Fade a deck when stopping alongside another playing deck</li>
        </ul>
      </div>
      <figure class="feature-image">
          <img src="${base}media/deck-playback.png" width="1568" height="842" alt="A music deck playing with its vinyl platter in motion and a separate volume control" loading="lazy" />
        <figcaption>Both decks stay visible while the event is underway.</figcaption>
      </figure>
    </section>

    <section class="sound-section">
      <div class="wrap sound-layout">
        <figure class="sound-image">
          <img src="${base}media/soundboard.png" width="1568" height="842" alt="Sound FX pads with individual volume controls and playback state" loading="lazy" />
          <figcaption>Sound effects are ready at the bottom of the workspace.</figcaption>
        </figure>
        <div class="sound-copy">
          <p class="eyebrow">SOUND FX</p>
          <h2>One tap for the moment.</h2>
          <p>Keep applause, cues and other short sounds in their own pads. Trigger more than one effect at a time, change each pad's level, or stop everything with one control.</p>
          <a class="text-link" href="#demo">Watch the quick tour <span aria-hidden="true">&#8594;</span></a>
        </div>
      </div>
    </section>

    <section class="demo-section wrap" id="demo" aria-labelledby="demo-title">
      <div class="demo-heading">
        <div><p class="eyebrow">THE WORKFLOW</p><h2 id="demo-title">See it in a minute.</h2></div>
        <p>Load music, set a deck playing, move the level between decks and fire a sound effect.</p>
      </div>
      <figure class="demo-player">
        <video controls playsinline preload="metadata" poster="${base}media/console-overview.png" aria-label="A one-minute DJMesrc workflow demonstration">
          <source src="${base}media/usage-demo.mp4" type="video/mp4" />
          <track kind="captions" src="${base}media/usage-demo.vtt" srclang="en" label="English captions" default />
          Your browser does not support embedded video. <a href="${base}media/usage-demo.mp4">Open the demo video</a>.
        </video>
        <figcaption>Silent screen recording with captions. No music files are included.</figcaption>
      </figure>
    </section>

    <section class="download-section" id="download" aria-labelledby="download-title">
      <div class="wrap download-layout">
        <div><p class="eyebrow">FOR WINDOWS x64</p><h2 id="download-title">Ready for your next event.</h2><p>Download the latest DJMesrc setup. Keep your music files on your computer and add them to a deck when you are ready.</p></div>
        <div class="download-actions">
          <a class="button button-light" href="${latestReleasePage}" id="download-final">Download</a>
          <a class="secondary-download" href="${latestReleasePage}" id="download-msi">Get the MSI installer</a>
          <span class="installer-meta" id="installer-meta">Latest version ${fallbackTag}</span>
        </div>
      </div>
    </section>

    <footer class="site-footer wrap">
      <a class="wordmark footer-mark" href="#top"><img src="${base}djmesrc-icon.png" alt="" width="30" height="30" /><span>DJMesrc<small>EVENT AUDIO DESK</small></span></a>
      <p>Built for the people who keep an event on schedule.</p>
      <div><a href="https://github.com/${repository}/releases" target="_blank" rel="noreferrer">Releases</a><a href="https://github.com/${repository}/issues" target="_blank" rel="noreferrer">Support</a></div>
    </footer>
  </main>
`;

type ReleaseAsset = { name: string; browser_download_url: string; size: number };
type LatestRelease = { tag_name: string; html_url: string; assets: ReleaseAsset[] };

const downloadLinks = [
  document.querySelector<HTMLAnchorElement>("#download-primary")!,
  document.querySelector<HTMLAnchorElement>("#download-final")!,
  document.querySelector<HTMLAnchorElement>("#download-msi")!,
  document.querySelector<HTMLAnchorElement>("#nav-download")!,
];
const versionLabels = [
  document.querySelector<HTMLElement>("#release-version")!,
  document.querySelector<HTMLElement>("#installer-meta")!,
];
const status = document.querySelector<HTMLElement>("#release-status")!;
const releaseFallback = `https://github.com/${repository}/releases/latest`;

function trustedDownloadUrl(asset: ReleaseAsset | undefined, fallback: string): string {
  if (!asset) return fallback;
  try {
    const url = new URL(asset.browser_download_url);
    return url.hostname === "github.com" && url.pathname.includes("/releases/download/") ? url.href : fallback;
  } catch {
    return fallback;
  }
}

async function loadLatestRelease(): Promise<void> {
  try {
    const response = await fetch(releaseApi, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json() as LatestRelease;
    if (!release.tag_name || !Array.isArray(release.assets)) throw new Error("Release details are incomplete");
    const setup = release.assets.find(asset => asset.name.endsWith("_x64-setup.exe"));
    const msi = release.assets.find(asset => asset.name.endsWith("_x64_en-US.msi"));
    const setupUrl = trustedDownloadUrl(setup, release.html_url || releaseFallback);
    const msiUrl = trustedDownloadUrl(msi, release.html_url || releaseFallback);

    downloadLinks.forEach(link => { link.href = setupUrl; });
    document.querySelector<HTMLAnchorElement>("#download-msi")!.href = msiUrl;
    versionLabels.forEach(label => { label.textContent = `Latest version ${release.tag_name.replace(/^v/i, "")}`; });
    const missing = [!setup && "Setup EXE", !msi && "MSI"].filter(Boolean).join(" and ");
    status.textContent = missing
      ? `${missing} download is not attached yet. Open the latest release page for available files.`
      : `Setup EXE ${formatBytes(setup!.size)}. MSI ${formatBytes(msi!.size)}.`;
  } catch {
    downloadLinks.forEach(link => { link.href = releaseFallback; });
    document.querySelector<HTMLAnchorElement>("#download-msi")!.href = releaseFallback;
    versionLabels.forEach(label => { label.textContent = `Latest release ${fallbackTag.replace(/^v/i, "")}`; });
    status.textContent = "Could not check the latest release right now. Open GitHub Releases to choose a download.";
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "size unavailable";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

void loadLatestRelease();
