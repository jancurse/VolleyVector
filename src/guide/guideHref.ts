import { buildPath } from "../routing/route";
import type { GuideTopicId } from "./guideContent";

/** The address of a guide topic, or of the guide's overview. */
export const guideHref = (topic: GuideTopicId | null): string => buildPath({ kind: "guide", topic });
