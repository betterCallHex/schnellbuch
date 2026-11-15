import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
import type { Id } from "@schnellbuch/backend/data-model";

const CONTROLS = "button, input, select, textarea";
const TOUCH_HOLD_MS = 250;
const TOUCH_TOLERANCE_PX = 5;
const MOUSE_DISTANCE_PX = 5;

export type DragItem =
  | { kind: "bookmark"; id: Id<"bookmarks"> }
  | { kind: "folder"; id: Id<"folders"> };

export interface DropTarget {
  folderId: Id<"folders"> | null;
}

export function dragItemId(item: DragItem) {
  return `${item.kind}:${item.id}`;
}

export function dropTargetId(target: DropTarget) {
  return `drop:${target.folderId ?? "top-level"}`;
}

export const dragSensors = [
  PointerSensor.configure({
    activationConstraints: dragStartConstraints,
    preventActivation: startsOnControl,
  }),
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ["Space"],
      cancel: ["Escape"],
      end: ["Space", "Enter"],
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
    },
  }),
];

function startsOnControl(event: PointerEvent) {
  return (
    event.target instanceof Element && event.target.closest(CONTROLS) !== null
  );
}

function dragStartConstraints(event: PointerEvent) {
  if (event.pointerType === "touch") {
    return [
      new PointerActivationConstraints.Delay({
        value: TOUCH_HOLD_MS,
        tolerance: TOUCH_TOLERANCE_PX,
      }),
    ];
  }
  return [
    new PointerActivationConstraints.Distance({ value: MOUSE_DISTANCE_PX }),
  ];
}
