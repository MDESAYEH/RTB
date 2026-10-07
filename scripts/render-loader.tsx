import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { BasketballLoading } from "../app/basketball-loading";
writeFileSync("verification/design-rebuild/loader-markup.html",renderToStaticMarkup(createElement(BasketballLoading)));

