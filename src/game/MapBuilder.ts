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
import { MAP_BOXES, type MapBoxColor } from "../../shared/mapGeometry";

function makeMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  return material;
}

function getMaterial(
  materials: Record<MapBoxColor, StandardMaterial>,
  color: MapBoxColor
): StandardMaterial {
  return materials[color];
}

export class MapBuilder {
  static build(scene: Scene): void {
    scene.clearColor.set(0.53, 0.77, 0.94, 1);

    const light = new HemisphericLight("sun", new Vector3(0.35, 1, 0.25), scene);
    light.intensity = 0.9;

    const materials: Record<MapBoxColor, StandardMaterial> = {
      sand: makeMaterial(scene, "sand", new Color3(0.78, 0.62, 0.38)),
      wall: makeMaterial(scene, "wall", new Color3(0.62, 0.48, 0.31)),
      accent: makeMaterial(scene, "accent", new Color3(0.33, 0.42, 0.52))
    };

    const ground = MeshBuilder.CreateGround(
      "ground",
      {
        width: MAP_HALF_SIZE * 2,
        height: MAP_HALF_SIZE * 2
      },
      scene
    );
    ground.material = materials.sand;

    for (const box of MAP_BOXES) {
      this.createBox(
        scene,
        box.id,
        box.centerX,
        box.visualY,
        box.centerZ,
        box.halfX * 2,
        box.height,
        box.halfZ * 2,
        getMaterial(materials, box.color)
      );
    }
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
