from PIL import Image, ImageDraw
import sys
out = sys.argv[1]
BG=(21,23,27); ACC=(255,95,69); RUN=(79,195,247)
def draw(size, maskable):
    S=size*4
    im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if maskable: d.rectangle([0,0,S,S],fill=BG)
    else: d.rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.22),fill=BG)
    k = 0.72 if maskable else 0.9   # zona segura
    c=S/2; u=S*k/10
    # barra
    d.rounded_rectangle([c-3.6*u,c-0.35*u,c+3.6*u,c+0.35*u],radius=u*0.3,fill=(238,240,243))
    # discos
    for sx in (-1,1):
        d.rounded_rectangle([c+sx*2.2*u-0.55*u,c-2.2*u,c+sx*2.2*u+0.55*u,c+2.2*u],radius=u*0.35,fill=ACC)
        d.rounded_rectangle([c+sx*3.2*u-0.4*u,c-1.4*u,c+sx*3.2*u+0.4*u,c+1.4*u],radius=u*0.3,fill=ACC)
    # línea de carrera
    d.rounded_rectangle([c-1.4*u,c+3.0*u,c+1.4*u,c+3.5*u],radius=u*0.25,fill=RUN)
    return im.resize((size,size),Image.LANCZOS)
for s in (192,512):
    draw(s,False).save(f'{out}/icon-{s}.png')
    draw(s,True).save(f'{out}/maskable-{s}.png')
draw(180,True).convert('RGB').save(f'{out}/apple-touch-icon.png')
draw(64,False).save(f'{out}/favicon.png')
