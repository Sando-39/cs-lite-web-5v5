export type MapBoxColor = "sand" | "wall" | "accent";

export type AabbCollider = {
  id: string;
  centerX: number;
  centerZ: number;
  halfX: number;
  halfZ: number;
};

export type MapBox = AabbCollider & {
  height: number;
  visualY: number;
  color: MapBoxColor;
};

export const MAP_BOXES: readonly MapBox[] = [
  {
    id: "north-wall",
    centerX: 0,
    centerZ: -24,
    halfX: 24,
    halfZ: 0.25,
    height: 3,
    visualY: 1.5,
    color: "wall"
  },
  {
    id: "south-wall",
    centerX: 0,
    centerZ: 24,
    halfX: 24,
    halfZ: 0.25,
    height: 3,
    visualY: 1.5,
    color: "wall"
  },
  {
    id: "west-wall",
    centerX: -24,
    centerZ: 0,
    halfX: 0.25,
    halfZ: 24,
    height: 3,
    visualY: 1.5,
    color: "wall"
  },
  {
    id: "east-wall",
    centerX: 24,
    centerZ: 0,
    halfX: 0.25,
    halfZ: 24,
    height: 3,
    visualY: 1.5,
    color: "wall"
  },
  {
    id: "cover-a",
    centerX: -8,
    centerZ: -6,
    halfX: 1.5,
    halfZ: 1.5,
    height: 2,
    visualY: 1,
    color: "wall"
  },
  {
    id: "cover-b",
    centerX: 8,
    centerZ: 6,
    halfX: 1.5,
    halfZ: 1.5,
    height: 2,
    visualY: 1,
    color: "wall"
  },
  {
    id: "cover-c",
    centerX: 0,
    centerZ: -10,
    halfX: 2,
    halfZ: 1,
    height: 2,
    visualY: 1,
    color: "accent"
  },
  {
    id: "cover-d",
    centerX: 0,
    centerZ: 10,
    halfX: 2,
    halfZ: 1,
    height: 2,
    visualY: 1,
    color: "accent"
  }
];

export const MAP_COLLIDERS: readonly AabbCollider[] = MAP_BOXES.map(
  ({ id, centerX, centerZ, halfX, halfZ }) => ({
    id,
    centerX,
    centerZ,
    halfX,
    halfZ
  })
);

export function validateMapGeometry(): void {
  const ids = new Set<string>();

  for (const box of MAP_BOXES) {
    if (ids.has(box.id)) {
      throw new Error(`Duplicate map geometry id: ${box.id}`);
    }

    ids.add(box.id);

    if (box.halfX <= 0 || box.halfZ <= 0 || box.height <= 0) {
      throw new Error(`Invalid map geometry dimensions for ${box.id}`);
    }
  }
}
