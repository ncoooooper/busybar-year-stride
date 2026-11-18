import {marks} from "./front";
import {instrument} from "@shared/instrument";

instrument({
  marks,
  "title": "YEAR STRIDE",
  "primary": "Year Stride",
  "accent": "#6ACBC6",
  "cadence": 30000,
  "motion": {enabled:false},
  "setup": "Start companion/serve.py"
});
