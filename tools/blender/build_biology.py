"""Blender 4.x: generate editable biological GLB models.

Run from repository root:
    blender --background --python tools/blender/build_biology.py
Produces four GLB assets and an editable .blend source.
Uses only Blender built-in APIs, without downloading any assets.
"""
import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'assets' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'tools' / 'blender' / 'biologie_source.blend'

# Clear factory scene, keeping independent source objects for reproducible exports.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgba, roughness=0.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = roughness
    return m


blood = material('Erythrocyte - hemoglobin red', (0.58, 0.018, 0.027, 1), 0.62)
platelet_mat = material('Platelet - muted violet', (0.48, 0.38, 0.62, 1), 0.83)
oxygen = material('Oxygen - red (CPK)', (0.8, 0.038, 0.035, 1), 0.4)
carbon = material('Carbon - charcoal (CPK)', (0.14, 0.16, 0.18, 1), 0.42)
bond_mat = material('Covalent bond - neutral', (0.67, 0.72, 0.79, 1), 0.52)


def smooth(obj):
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj


def erythrocyte():
    # Surface of revolution: centre thinner than raised rim on BOTH faces.
    profile = [
        (0.001, 0.16), (0.18, 0.18), (0.4, 0.26),
        (0.65, 0.38), (0.82, 0.39), (0.96, 0.26), (1.0, 0.0),
        (0.96, -0.26), (0.82, -0.39), (0.65, -0.38),
        (0.4, -0.26), (0.18, -0.18), (0.001, -0.16),
    ]
    sides = 48
    verts = [(r * math.cos(2 * math.pi * j / sides),
              r * math.sin(2 * math.pi * j / sides), z)
             for r, z in profile for j in range(sides)]
    faces = []
    for ring in range(len(profile) - 1):
        for j in range(sides):
            nxt = (j + 1) % sides
            faces.append((ring * sides + j, ring * sides + nxt,
                          (ring + 1) * sides + nxt, (ring + 1) * sides + j))
    faces.extend([tuple(reversed(tuple(range(sides)))),
                  tuple((len(profile) - 1) * sides + j for j in range(sides))])
    mesh = bpy.data.meshes.new('Biconcave disc geometry')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Erythrocyte_Biconcave', mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(blood)
    return [smooth(obj)]


def platelet():
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    obj = bpy.context.object
    obj.name = 'Platelet_IrregularFragment'
    for v in obj.data.vertices:
        x, y, z = v.co
        distortion = 1 + 0.13 * math.sin(11 * x + 7 * y)
        v.co = (x * 0.32 * distortion, y * 0.30 * distortion, z * 0.12)
    obj.data.materials.append(platelet_mat)
    return [smooth(obj)]


def sphere(name, at, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=radius, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return smooth(obj)


def bond(name, at, length):
    # Cylinder stands along Z by default; rotate to lie along X.
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.035, depth=length, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler[1] = math.pi / 2
    obj.data.materials.append(bond_mat)
    return smooth(obj)


def o2():
    objects = [sphere('Oxygen_1', (-0.49, 0, 0), 0.41, oxygen),
               sphere('Oxygen_2', (+0.49, 0, 0), 0.41, oxygen)]
    for i, y in enumerate([-0.11, 0.11]):
        objects.append(bond(f'DoubleBond_O2_{i+1}', (0, y, 0), 0.33))
    return objects


def co2():
    objects = [sphere('Carbon_C', (0, 0, 0), 0.34, carbon),
               sphere('Oxygen_left', (-0.95, 0, 0), 0.41, oxygen),
               sphere('Oxygen_right', (0.95, 0, 0), 0.41, oxygen)]
    for sign in [-1, 1]:
        for i, y in enumerate([-0.11, 0.11]):
            objects.append(bond(f'DoubleBond_CO2_{sign}_{i}', (sign * 0.47, y, 0), 0.37))
    return objects


def export(filename, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / filename), export_format='GLB', use_selection=True,
        export_yup=True,
    )
    print('EXPORT:', OUT / filename)


export('erythrocyte.glb', erythrocyte())
export('platelet.glb', platelet())
export('oxygen_o2.glb', o2())
export('carbon_dioxide_co2.glb', co2())
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print('SOURCE BLENDER:', SOURCE)
