import { Accessibility, Coffee, DoorOpen, Footprints, Hammer, LogIn, PanelTop, Signpost, Star, Theater, TrafficCone, TriangleAlert, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { IconObject } from "@/types/seat-chart";

export function IconNode({ object }: { readonly object: IconObject }): ReactNode {
  const size = object.size ?? 40;
  const props = { x: object.position.x - size / 2, y: object.position.y - size / 2, width: size, height: size, color: object.color ?? "var(--editor-text)", strokeWidth: 1.5 } as const;
  if (object.icon === "stage") return <Theater {...props} />;
  if (object.icon === "wc") return <Accessibility {...props} />;
  if (object.icon === "star") return <Star {...props} />;
  if (object.icon === "people") return <Users {...props} />;
  if (object.icon === "male" || object.icon === "female") return <User {...props} />;
  if (object.icon === "cone") return <TrafficCone {...props} />;
  if (object.icon === "entrance") return <LogIn {...props} />;
  if (object.icon === "emergencyExit") return <DoorOpen {...props} />;
  if (object.icon === "stairs") return <Footprints {...props} />;
  if (object.icon === "tools") return <Hammer {...props} />;
  if (object.icon === "signpost") return <Signpost {...props} />;
  if (object.icon === "elevator") return <PanelTop {...props} />;
  if (object.icon === "coffee") return <Coffee {...props} />;
  if (object.icon === "warning") return <TriangleAlert {...props} />;
  return <DoorOpen {...props} />;
}
