"""Gera uma textura de desgaste (máscara com alfa) para o nome MAG!ON!.
Opaco = letra aparece; transparente = risco/rachadura/falha.
Uso: python3 grunge.py saida.png [semente]
"""
import math
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

W, H = 1400, 700
out = sys.argv[1]
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 7
rng = random.Random(seed)
np.random.seed(seed)

SS = 2  # supersampling para traços finos e suaves
damage = Image.new('L', (W * SS, H * SS), 0)
d = ImageDraw.Draw(damage)


def polyline(x, y, ang, length, step, wobble, width):
    pts = [(x, y)]
    for _ in range(int(length / step)):
        ang += rng.gauss(0, wobble)
        x += math.cos(ang) * step
        y += math.sin(ang) * step
        pts.append((x, y))
    d.line([(px * SS, py * SS) for px, py in pts], fill=255, width=max(1, int(width * SS)), joint='curve')
    return pts


# 1) Rede de rachaduras finas que se ramificam
def crack(x, y, ang, length, depth=0):
    pts = polyline(x, y, ang, length, step=rng.uniform(4, 9), wobble=0.35, width=rng.uniform(0.8, 1.6))
    if depth < 3:
        for _ in range(rng.randint(1, 3)):
            px, py = rng.choice(pts)
            crack(px, py, ang + rng.choice([-1, 1]) * rng.uniform(0.5, 1.3), length * rng.uniform(0.3, 0.6), depth + 1)


for _ in range(95):
    crack(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0, 2 * math.pi), rng.uniform(60, 220))

# 2) Riscos longos e quase retos (arranhões)
for _ in range(80):
    polyline(rng.uniform(-100, W), rng.uniform(0, H), rng.uniform(-0.6, 0.6) + rng.choice([0, math.pi]),
             rng.uniform(150, 600), step=12, wobble=0.04, width=rng.uniform(0.5, 1.1))

# 3) Respingos e pontinhos
for _ in range(4200):
    x, y = rng.uniform(0, W) * SS, rng.uniform(0, H) * SS
    r = rng.choice([0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.6]) * SS
    d.ellipse([x - r, y - r, x + r, y + r], fill=255)

damage = damage.resize((W, H), Image.LANCZOS)
dmg = np.asarray(damage, dtype=np.float32) / 255.0

# 4) Manchas de desgaste: ruído de baixa frequência limiarizado (falhas de tinta)
noise = ndimage.gaussian_filter(np.random.rand(H, W), 6)
noise = (noise - noise.min()) / (noise.max() - noise.min())
fine = ndimage.gaussian_filter(np.random.rand(H, W), 1.2)
fine = (fine - fine.min()) / (fine.max() - fine.min())
worn = ((noise > 0.70) & (fine > 0.52)).astype(np.float32)
grain = (ndimage.gaussian_filter(np.random.rand(H, W), 0.6) > 0.66).astype(np.float32) * (noise > 0.6)
worn = np.clip(worn + grain, 0, 1)

holes = np.clip(dmg + worn, 0, 1)
alpha = (1.0 - holes) * 255
Image.fromarray(alpha.astype(np.uint8), 'L').save('/tmp/_a.png')

# Paleta de 2 cores (preto opaco / transparente): arquivo bem leve
bw = Image.fromarray(((alpha > 225) * 255).astype(np.uint8), 'L').convert('1').convert('L')
pal = bw.point(lambda v: 0 if v else 1).convert('P')
pal.putpalette([0, 0, 0, 0, 0, 0])
pal.save(out, optimize=True, transparency=1)
print(out, W, H)
