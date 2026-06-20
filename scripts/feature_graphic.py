#!/usr/bin/env python3
"""Genera el Gráfico de funciones (1024x500) para Play Store."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1024, 500
# Marca
ORANGE_TOP = (251, 146, 60)   # #FB923C
ORANGE_BOT = (234, 88, 12)    # #EA580C  (gradiente como el ícono)
WHITE = (255, 255, 255)

img = Image.new("RGB", (W, H))
px = img.load()
# Gradiente diagonal suave
for y in range(H):
    for x in range(W):
        t = (x / W * 0.35) + (y / H * 0.65)
        r = int(ORANGE_TOP[0] + (ORANGE_BOT[0] - ORANGE_TOP[0]) * t)
        g = int(ORANGE_TOP[1] + (ORANGE_BOT[1] - ORANGE_TOP[1]) * t)
        b = int(ORANGE_TOP[2] + (ORANGE_BOT[2] - ORANGE_TOP[2]) * t)
        px[x, y] = (r, g, b)

draw = ImageDraw.Draw(img, "RGBA")

# Círculos decorativos sutiles
draw.ellipse([-120, -160, 220, 180], fill=(255, 255, 255, 16))
draw.ellipse([820, 300, 1180, 660], fill=(255, 255, 255, 14))

# --- Tarjeta con el ícono a la izquierda ---
icon = Image.open("assets/icon.png").convert("RGBA")
ICON = 230
icon = icon.resize((ICON, ICON), Image.LANCZOS)
# Tarjeta blanca redondeada detrás del ícono
pad = 26
card_x, card_y = 70, (H - ICON) // 2
cw, ch = ICON + pad * 2, ICON + pad * 2
card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
ImageDraw.Draw(card).rounded_rectangle([0, 0, cw, ch], radius=52, fill=(255, 255, 255, 38))
img.paste(card, (card_x - pad, card_y - pad), card)
# El ícono ya viene redondeado/cuadrado; lo recortamos a esquinas suaves
mask = Image.new("L", (ICON, ICON), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, ICON, ICON], radius=46, fill=255)
img.paste(icon, (card_x, card_y), mask)

# --- Tipografías ---
def font(path, size):
    return ImageFont.truetype(path, size)

ARIAL_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
f_brand = font(ARIAL_BOLD, 74)
f_brand2 = font(ARIAL_BOLD, 74)
f_tag = font(ARIAL, 38)
f_pill = font(ARIAL_BOLD, 27)

tx = card_x - pad + cw + 56  # inicio del texto

# Título en dos líneas
draw.text((tx, 150), "ComandPOS", font=f_brand, fill=WHITE)
draw.text((tx, 228), "Delivery", font=f_brand2, fill=WHITE)

# Tagline
draw.text((tx, 322), "Tus entregas, en tiempo real", font=f_tag, fill=(255, 255, 255, 235))

# Pill / badge
pill_text = "APP PARA REPARTIDORES"
bbox = draw.textbbox((0, 0), pill_text, font=f_pill)
pw, ph = bbox[2] - bbox[0], bbox[3] - bbox[1]
pill_pad_x, pill_pad_y = 22, 12
py = 80
draw.rounded_rectangle(
    [tx, py, tx + pw + pill_pad_x * 2, py + ph + pill_pad_y * 2 + 6],
    radius=30, fill=(255, 255, 255, 230)
)
draw.text((tx + pill_pad_x, py + pill_pad_y), pill_text, font=f_pill, fill=ORANGE_BOT)

out = "assets/store/feature-graphic.png"
import os
os.makedirs("assets/store", exist_ok=True)
img.save(out, "PNG")
print("OK ->", out, img.size)
