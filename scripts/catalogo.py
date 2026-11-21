# Genera js/catalogo.js y las imágenes (webp) a partir de free-exercise-db (dominio público).
# Uso: python3 catalogo.py <ruta free-exercise-db/exercises> <ruta repo entreno>
import json, os, sys
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
# id, nombre, grupo, músculo, modo, series, repMin, repMax, incremento, idDB, notas
K, C, T = 'kg', 'corporal', 'tiempo'
E = [
 # ---- pierna ----
 ('prensa','Prensa de piernas','pierna','cuádriceps',K,3,10,12,5,'Leg_Press','No despegues la zona lumbar del respaldo'),
 ('extension-cuad','Extensión de cuádriceps','pierna','cuádriceps',K,3,10,15,2.5,'Leg_Extensions',''),
 ('curl-femoral','Curl femoral sentado','pierna','isquios',K,3,10,15,2.5,'Seated_Leg_Curl',''),
 ('curl-femoral-tumbado','Curl femoral tumbado','pierna','isquios',K,3,10,15,2.5,'Lying_Leg_Curls',''),
 ('hip-thrust','Hip thrust con barra','pierna','glúteo',K,3,8,12,5,'Barbell_Hip_Thrust','Aprieta glúteo arriba sin arquear la zona lumbar'),
 ('puente-gluteo','Puente de glúteo con barra','pierna','glúteo',K,3,10,15,5,'Barbell_Glute_Bridge',''),
 ('puente-gluteo-unilateral','Puente de glúteo a una pierna','pierna','glúteo',C,3,10,15,0,'Single_Leg_Glute_Bridge','Repeticiones por pierna'),
 ('aductores','Aductores en máquina','pierna','aductores',K,3,12,15,5,'Thigh_Adductor',''),
 ('abductores','Abductores en máquina','pierna','glúteo',K,3,12,15,5,'Thigh_Abductor',''),
 ('patada-gluteo-polea','Patada de glúteo en polea','pierna','glúteo',K,3,12,15,1,'One-Legged_Cable_Kickback','Repeticiones por pierna'),
 ('zancadas','Zancadas con mancuernas','pierna','cuádriceps',K,3,8,12,2,'Dumbbell_Lunges','Peso de cada mancuerna; repeticiones por pierna'),
 ('zancada-atras','Zancada hacia atrás con mancuernas','pierna','cuádriceps',K,3,8,12,2,'Dumbbell_Rear_Lunge','Peso de cada mancuerna; repeticiones por pierna'),
 ('step-up','Subida al banco con mancuernas','pierna','cuádriceps',K,3,8,12,2,'Dumbbell_Step_Ups','Peso de cada mancuerna; repeticiones por pierna'),
 ('peso-muerto-rumano','Peso muerto rumano','pierna','isquios',K,3,8,12,2.5,'Romanian_Deadlift','Con cautela por la zona lumbar: espalda neutra y sin ego'),
 ('peso-muerto-mancuernas','Peso muerto piernas rígidas con mancuernas','pierna','isquios',K,3,8,12,2,'Stiff-Legged_Dumbbell_Deadlift','Con cautela por la zona lumbar'),
 ('hiperextensiones','Hiperextensiones','pierna','lumbar',C,3,10,15,0,'Hyperextensions_Back_Extensions','Sin pasar de la horizontal'),
 ('pull-through','Pull-through en polea','pierna','glúteo',K,3,10,15,2.5,'Pull_Through',''),
 ('gemelo-sentado','Gemelo sentado','pierna','gemelo',K,3,12,15,2.5,'Seated_Calf_Raise','Recorrido completo y lento: tus gemelos lo agradecen'),
 ('gemelo-de-pie','Gemelo de pie en máquina','pierna','gemelo',K,3,10,15,5,'Standing_Calf_Raises','Recorrido completo y lento'),
 ('gemelo-prensa','Gemelo en prensa','pierna','gemelo',K,3,12,15,5,'Calf_Press_On_The_Leg_Press_Machine',''),
 # ---- empuje ----
 ('press-pecho','Press de pecho en máquina','empuje','pecho',K,3,8,12,2.5,'Leverage_Chest_Press',''),
 ('press-banca','Press de banca con barra','empuje','pecho',K,3,6,10,2.5,'Barbell_Bench_Press_-_Medium_Grip',''),
 ('press-banca-mancuernas','Press de banca con mancuernas','empuje','pecho',K,3,8,12,2,'Dumbbell_Bench_Press','Peso de cada mancuerna'),
 ('press-inclinado','Press inclinado con mancuernas','empuje','pecho',K,3,8,12,2,'Incline_Dumbbell_Press','Peso de cada mancuerna'),
 ('press-inclinado-maquina','Press inclinado en máquina','empuje','pecho',K,3,8,12,2.5,'Leverage_Incline_Chest_Press',''),
 ('press-multipower','Press de banca en multipower','empuje','pecho',K,3,8,12,2.5,'Smith_Machine_Bench_Press',''),
 ('aperturas','Aperturas con mancuernas','empuje','pecho',K,3,10,15,1,'Dumbbell_Flyes','Peso de cada mancuerna'),
 ('contractora','Contractora (pec deck)','empuje','pecho',K,3,10,15,2.5,'Butterfly',''),
 ('cruce-poleas','Cruce de poleas','empuje','pecho',K,3,10,15,1,'Cable_Crossover',''),
 ('flexiones','Flexiones','empuje','pecho',C,3,8,20,0,'Pushups',''),
 ('flexiones-inclinadas','Flexiones inclinadas','empuje','pecho',C,3,8,20,0,'Incline_Push-Up','Más fácil cuanto más alto el apoyo'),
 ('fondos','Fondos en paralelas','empuje','tríceps',C,3,6,12,0,'Dips_-_Triceps_Version','Si usas lastre, apunta los kg; si no, 0'),
 ('fondos-maquina','Fondos en máquina','empuje','tríceps',K,3,8,12,2.5,'Dip_Machine',''),
 ('fondos-banco','Fondos en banco','empuje','tríceps',C,3,10,15,0,'Bench_Dips',''),
 ('press-hombro-maquina','Press de hombro en máquina','empuje','hombro',K,3,8,12,2.5,'Machine_Shoulder_Military_Press',''),
 ('press-hombro-mancuernas','Press de hombro con mancuernas','empuje','hombro',K,3,8,12,2,'Seated_Dumbbell_Press','Sentado y con respaldo para cuidar la zona lumbar'),
 ('press-arnold','Press Arnold','empuje','hombro',K,3,8,12,2,'Arnold_Dumbbell_Press','Peso de cada mancuerna'),
 ('elevaciones','Elevaciones laterales','empuje','hombro',K,3,12,15,1,'Side_Lateral_Raise','Hombros lejos de las orejas para no cargar el cuello'),
 ('elevaciones-polea','Elevaciones laterales en polea','empuje','hombro',K,3,12,15,1,'Standing_Low-Pulley_Deltoid_Raise','Repeticiones por brazo'),
 ('elevaciones-frontales','Elevaciones frontales','empuje','hombro',K,3,10,15,1,'Front_Dumbbell_Raise',''),
 ('triceps-polea','Tríceps en polea con barra','empuje','tríceps',K,3,10,15,2.5,'Triceps_Pushdown',''),
 ('triceps-cuerda','Tríceps en polea con cuerda','empuje','tríceps',K,3,10,15,2.5,'Triceps_Pushdown_-_Rope_Attachment',''),
 ('triceps-cuerda-alto','Extensión de tríceps sobre la cabeza con cuerda','empuje','tríceps',K,3,10,15,2.5,'Triceps_Overhead_Extension_with_Rope',''),
 ('press-frances','Press francés con barra Z','empuje','tríceps',K,3,8,12,2.5,'EZ-Bar_Skullcrusher',''),
 ('patada-triceps','Patada de tríceps','empuje','tríceps',K,3,10,15,1,'Tricep_Dumbbell_Kickback',''),
 ('triceps-maquina','Extensión de tríceps en máquina','empuje','tríceps',K,3,10,15,2.5,'Machine_Triceps_Extension',''),
 # ---- tirón ----
 ('jalon','Jalón al pecho','tirón','espalda',K,3,8,12,2.5,'Wide-Grip_Lat_Pulldown','Tira hacia el pecho, nunca por detrás de la nuca'),
 ('jalon-estrecho','Jalón con agarre estrecho','tirón','espalda',K,3,8,12,2.5,'Close-Grip_Front_Lat_Pulldown',''),
 ('jalon-unilateral','Jalón a una mano','tirón','espalda',K,3,10,12,1,'One_Arm_Lat_Pulldown','Repeticiones por brazo'),
 ('dominadas','Dominadas','tirón','espalda',C,3,4,10,0,'Pullups','Si usas lastre, apunta los kg; si no, 0'),
 ('dominadas-supinas','Dominadas supinas','tirón','espalda',C,3,4,10,0,'Chin-Up','Si usas lastre, apunta los kg; si no, 0'),
 ('remo-polea','Remo sentado en polea','tirón','espalda',K,3,8,12,2.5,'Seated_Cable_Rows','Espalda recta, sin balancearte'),
 ('remo-apoyo','Remo con apoyo en el pecho','tirón','espalda',K,3,8,12,2,'Dumbbell_Incline_Row','Pecho apoyado para descargar los lumbares'),
 ('remo-mancuerna','Remo con mancuerna a una mano','tirón','espalda',K,3,8,12,2,'One-Arm_Dumbbell_Row','Apoya rodilla y mano en el banco'),
 ('remo-maquina','Remo en máquina','tirón','espalda',K,3,8,12,2.5,'Leverage_Iso_Row',''),
 ('remo-alto-maquina','Remo alto en máquina','tirón','espalda',K,3,8,12,2.5,'Leverage_High_Row',''),
 ('remo-barra','Remo con barra','tirón','espalda',K,3,8,12,2.5,'Bent_Over_Barbell_Row','Con cautela por la zona lumbar'),
 ('remo-t','Remo en T','tirón','espalda',K,3,8,12,2.5,'T-Bar_Row_with_Handle','Con cautela por la zona lumbar'),
 ('pullover-polea','Pullover en polea','tirón','espalda',K,3,10,15,2.5,'Straight-Arm_Pulldown',''),
 ('face-pull','Face pull en polea','tirón','hombro',K,3,12,15,2.5,'Face_Pull',''),
 ('pajaros','Pájaros con mancuernas','tirón','hombro',K,3,12,15,1,'Reverse_Flyes','Peso de cada mancuerna'),
 ('pajaros-maquina','Pájaros en máquina','tirón','hombro',K,3,12,15,2.5,'Reverse_Machine_Flyes',''),
 ('encogimientos','Encogimientos con mancuernas','tirón','trapecio',K,3,10,15,2,'Dumbbell_Shrug','Con cautela por el cuello: sin cargas pesadas'),
 ('curl-biceps','Curl de bíceps con mancuernas','tirón','bíceps',K,3,10,15,2,'Dumbbell_Bicep_Curl','Peso de cada mancuerna'),
 ('curl-martillo','Curl martillo','tirón','bíceps',K,3,10,15,2,'Hammer_Curls','Peso de cada mancuerna'),
 ('curl-barra','Curl con barra','tirón','bíceps',K,3,8,12,2.5,'Barbell_Curl',''),
 ('curl-z','Curl con barra Z','tirón','bíceps',K,3,8,12,2.5,'EZ-Bar_Curl',''),
 ('curl-inclinado','Curl inclinado con mancuernas','tirón','bíceps',K,3,10,15,1,'Incline_Dumbbell_Curl',''),
 ('curl-concentrado','Curl concentrado','tirón','bíceps',K,3,10,15,1,'Concentration_Curls','Repeticiones por brazo'),
 ('curl-predicador','Curl predicador en máquina','tirón','bíceps',K,3,10,15,2.5,'Machine_Preacher_Curls',''),
 ('curl-polea','Curl en polea','tirón','bíceps',K,3,10,15,2.5,'Standing_Biceps_Cable_Curl',''),
 ('paseo-granjero','Paseo del granjero','tirón','agarre',T,3,30,60,0,'Farmers_Walk','Reps = segundos caminando; apunta los kg de cada mancuerna'),
 # ---- core ----
 ('plancha','Plancha','core','abdomen',T,3,20,60,0,'Plank','Reps = segundos aguantando'),
 ('plancha-lateral','Plancha lateral','core','oblicuos',T,3,15,45,0,'Side_Bridge','Reps = segundos por lado'),
 ('dead-bug','Dead bug','core','abdomen',C,3,8,12,0,'Dead_Bug','Repeticiones por lado; zona lumbar pegada al suelo'),
 ('pallof','Pallof press en polea','core','abdomen',K,3,10,12,2.5,'Pallof_Press','Repeticiones por lado; core firme, sin girar'),
 ('crunch-polea','Crunch en polea','core','abdomen',K,3,10,15,2.5,'Cable_Crunch',''),
 ('crunch-maquina','Crunch en máquina','core','abdomen',K,3,10,15,2.5,'Ab_Crunch_Machine',''),
 ('crunch','Crunch abdominal','core','abdomen',C,3,12,20,0,'Crunches','Sin tirar del cuello'),
 ('crunch-inverso','Crunch inverso','core','abdomen',C,3,10,15,0,'Reverse_Crunch',''),
 ('elevacion-piernas-colgado','Elevación de piernas colgado','core','abdomen',C,3,8,15,0,'Hanging_Leg_Raise',''),
 ('elevacion-piernas-banco','Elevación de piernas en banco','core','abdomen',C,3,10,15,0,'Flat_Bench_Lying_Leg_Raise',''),
 ('rueda-abdominal','Rueda abdominal','core','abdomen',C,3,6,12,0,'Ab_Roller','Con cautela por la zona lumbar'),
 ('lenador-polea','Leñador en polea','core','oblicuos',K,3,10,12,2.5,'Standing_Cable_Wood_Chop','Repeticiones por lado'),
]
# imágenes para la rutina de movilidad (índice como en app.js)
MOV = ['Standing_Gastrocnemius_Calf_Stretch','Calf_Stretch_Hands_Against_Wall','Kneeling_Hip_Flexor','Cat_Stretch','Childs_Pose','Side_Neck_Stretch','Hamstring_Stretch']

def conv(db_id, slug):
    meta = json.load(open(os.path.join(SRC, db_id + '.json')))
    out = os.path.join(DST, 'img', 'ej', slug); os.makedirs(out, exist_ok=True)
    n = 0
    for i, rel in enumerate(meta['images'][:2]):
        im = Image.open(os.path.join(SRC, rel)).convert('RGB')
        im.thumbnail((480, 480))
        im.save(os.path.join(out, f'{i}.webp'), 'WEBP', quality=72, method=6)
        n += 1
    return n

ids = set()
filas = []
for (i, nom, g, mus, modo, s, a, b, inc, db, notas) in E:
    assert i not in ids, i; ids.add(i)
    n = conv(db, i)
    filas.append(dict(id=i, nombre=nom, grupo=g, musculo=mus, modo=modo, series=s, repMin=a, repMax=b, incremento=inc, notas=notas, fotos=n))
for k, db in enumerate(MOV):
    conv(db, f'mov-{k}')

js = '// Catálogo de ejercicios en español. Fotos: free-exercise-db (dominio público), en img/ej/<id>/0.webp y 1.webp.\n'
js += '// Generado por scripts/catalogo.py: no editar a mano.\n'
js += 'export const CATALOGO = ' + json.dumps(filas, ensure_ascii=False, indent=0).replace('\n', '') .replace('}, {', '},\n  {') + ';\n'
js += 'export const GRUPOS = { pierna: "Pierna", empuje: "Empuje", "tirón": "Tirón", core: "Core" };\n'
open(os.path.join(DST, 'js', 'catalogo.js'), 'w').write(js)
print(len(filas), 'ejercicios')
