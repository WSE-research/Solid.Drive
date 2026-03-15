// ─── TBox UI: displays the class hierarchy ────────────────────────────────────

import type { FunctionComponent } from "react";
import { FILE_TYPE_DEFS } from "./catalog";

export const TBoxSection: FunctionComponent = () => (
  <section className="catalog-section">
    <h3 className="catalog-section__heading">What types of files can be stored?</h3>
    <div className="catalog-tbox">
      {FILE_TYPE_DEFS.map((fileClass) => (
        <div key={fileClass.uri} className="catalog-tbox__row">
          <span className="catalog-tbox__label">{fileClass.label}</span>
          <span className="catalog-tbox__note">{fileClass.description}</span>
        </div>
      ))}
    </div>
  </section>
);
