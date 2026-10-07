import { BasketballGlyph, CourtArc } from "./brand-primitives";
export function BasketballLoading() {
  return (
    <main
      className="basketball-loading"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل البطولة"
    >
      <span className="loading-edition" dir="ltr">
        TRIPOLI / 2027
      </span>
      <CourtArc className="loading-court" />
      <div className="loading-stage" aria-hidden="true">
        <div className="loading-ball-route">
          <div className="loading-ball-travel">
            <BasketballGlyph className="loading-ball" />
          </div>
          <span className="loading-impact" />
        </div>
        <span className="loading-baseline" />
      </div>
      <div className="loading-title" dir="ltr">
        <span>ROAD</span>
        <small>TO</small>
        <span>BAL</span>
      </div>
      <p>اللعبة تبدأ هنا</p>
      <span className="loading-caption">جارٍ التحميل</span>
    </main>
  );
}
