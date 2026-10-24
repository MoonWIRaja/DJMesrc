import type { DeckId } from "@djmesrc/domain";

export function RecordPlatter({ deckId, spinning }: { deckId: DeckId; spinning: boolean }) {
  const letter = deckId === "left" ? "A" : "B";
  return (
    <div className={`record-platter record-${deckId} ${spinning ? "record-active" : ""}`} aria-hidden="true" data-spinning={spinning}>
      <div className="record-vinyl">
        <img src="/assets/vinyl-grooves.svg" alt="" />
        <span className="record-label">
          <small className="record-label-type">DJMESRC</small>
          <strong>{letter}</strong>
          <small className="record-label-speed">33⅓ RPM</small>
        </span>
        <span className="record-spindle"><span /></span>
      </div>
    </div>
  );
}
