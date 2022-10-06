import { CategoryProvider } from "typescript-logging-category-style";
import { LogLevel } from "typescript-logging";

export const RootLogger = CategoryProvider.createProvider("RewindLogProvider", {
  level: LogLevel.Info,
}).getCategory("rewind");

