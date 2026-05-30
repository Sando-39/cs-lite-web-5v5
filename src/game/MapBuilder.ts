import {
  Color3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import { MAP_HALF_SIZE } from "../../shared/constants";

function makeMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  return material;
}

export class MapBuilder {
  static build(scene: Scene): void {
    scene.clearColor.set(0.53, 0.77, 0.94, 1);

    const light = new HemisphericLight("sun", new Vector3(0.35, 1, 0.25), scene);
    light.intensity = 0.9;

    const sand = makeMaterial(scene, "sand", new Color3(0.78, 0.62, 0.38));
    const wall = makeMaterial(scene, "wall", new Color3(0.62, 0.48, 0.31));
    const accent = makeMaterial(scene, "accent", new Color3(0.33, 0.42, 0.52));

    const ground = MeshBuilder.CreateGround(
      "ground",
      {
        width: MAP_HALF_SIZE * 2,
        height: MAP_HALF_SIZE * 2
      },
      scene
    );
    ground.material = sand;

    this.createBox(scene, "north-wall", 0, 1.5, -MAP_HALF_SIZE, MAP_HALF_SIZE * 2, 3, 0.5, wall);
    this.createBox(scene, "south-wall", 0, 1.5, MAP_HALF_SIZE, MAP_HALF_SIZE * 2, 3, 0.5, wall);
    this.createBox(scene, "west-wall", -MAP_HALF_SIZE, 1.5, 0, 0.5, 3, MAP_HALF_SIZE * 2, wall);
    this.createBox(scene, "east-wall", MAP_HALF_SIZE, 1.5, 0, 0.5, 3, MAP_HALF_SIZE * 2, wall);

    this.createBox(scene, "cover-a", -8, 1, -6, 3, 2, 3, wall);
    this.createBox(scene, "cover-b", 8, 1, 6, 3, 2, 3, wall);
    this.createBox(scene, "cover-c", 0, 1, -10, 4, 2, 2, accent);
    this.createBox(scene, "cover-d", 0, 1, 10, 4, 2, 2, accent);
  }

  private static createBox(
    scene: Scene,
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: StandardMaterial
  ): Mesh {
    const box = MeshBuilder.CreateBox(
      name,
      {
        width,
        height,
        depth
      },
      scene
    );
    box.position.set(x, y, z);
    box.material = material;
    return box;
  }
}
