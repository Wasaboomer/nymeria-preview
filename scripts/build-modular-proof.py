"""Build the four isolated DEV previews from the user's CC0 Quaternius ZIPs.
Usage: python3 scripts/build-modular-proof.py /path/to/packs (requires numpy and Pillow).
Static posed GLBs; no changes to gameplay or the Kaelith reference assets.
"""
import json, struct, zipfile, sys, copy, io
from PIL import Image
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
PACKS=Path(sys.argv[1])
BASE=zipfile.ZipFile(PACKS/'Universal Base Characters[Standard].zip')
OUT=zipfile.ZipFile(PACKS/'Modular Character Outfits - Fantasy[Standard].zip')

def source(z,suffix,part=''):
    path=next(n for n in z.namelist() if n.endswith(suffix) and part in n)
    d=json.loads(z.read(path)); binary=z.read(str(Path(path).parent/d['buffers'][0]['uri']))
    return z,path,d,binary

def array(s,i):
    d,b=s[2:];a=d['accessors'][i];v=d['bufferViews'][a['bufferView']]
    typ={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    return np.frombuffer(b,dtype=typ,count=a['count']*size,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],size).copy()

def quat(q):
    x,y,z,w=q
    return np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])

def pose(s):
    nodes=s[2]['nodes']; parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};cache={}
    def world(i):
        if i in cache:return cache[i]
        n=nodes[i];m=np.eye(4);m[:3,:3]=quat(n.get('rotation',[0,0,0,1]))@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);cache[i]=(world(parents[i])@m if i in parents else m);return cache[i]
    arms={}
    for side in ['l','r']:
        i=next(i for i,n in enumerate(nodes) if n.get('name')=='upperarm_'+side)
        pivot=world(i)[:3,3];angle=(-1 if pivot[0]>0 else 1)*np.pi/3
        r=np.array([[np.cos(angle),-np.sin(angle),0],[np.sin(angle),np.cos(angle),0],[0,0,1]])
        desc=set()
        def collect(i):
            desc.add(i)
            for c in nodes[i].get('children',[]):collect(c)
        collect(i); arms[side]=(pivot,r,desc)
    hand=next(i for i,n in enumerate(nodes) if n.get('name')=='hand_r');pivot,r,_=arms['r'];grip=pivot+r@(world(hand)[:3,3]-pivot)
    return arms,grip

class Builder:
    def __init__(self):
        self.d={'asset':{'version':'2.0','generator':'Nymeria DEV modular proof / Quaternius CC0'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'textures':[],'images':[],'accessors':[],'bufferViews':[],'buffers':[{}]};self.b=bytearray();self.textures={}
    def view(self,data):
        while len(self.b)%4:self.b.append(0)
        i=len(self.d['bufferViews']);self.d['bufferViews'].append({'buffer':0,'byteOffset':len(self.b),'byteLength':len(data)});self.b.extend(data);return i
    def acc(self,a,kind):
        component=5125 if kind=='SCALAR' else 5126;a=np.asarray(a,dtype='<u4' if component==5125 else '<f4')
        x={'bufferView':self.view(a.tobytes()),'componentType':component,'count':len(a),'type':kind}
        if kind=='VEC3':x.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
        i=len(self.d['accessors']);self.d['accessors'].append(x);return i
    def material(self,s,i):
        m=copy.deepcopy(s[2]['materials'][i]);m.pop('normalTexture',None);m.pop('occlusionTexture',None);m.pop('extensions',None)
        p=m.setdefault('pbrMetallicRoughness',{});p.pop('metallicRoughnessTexture',None);p['metallicFactor']=0;p['roughnessFactor']=.8
        if 'Hair_' in s[1]:p['baseColorFactor']=[.72,.55,.36,1]
        if 'baseColorTexture' in p:
            t=p['baseColorTexture'];img=s[2]['images'][s[2]['textures'][t['index']]['source']];path=str(Path(s[1]).parent/img['uri']);key=(s[0].filename,path)
            if key not in self.textures:
                original=s[0].read(path); image=Image.open(io.BytesIO(original)).convert('RGBA'); image.thumbnail((1024,1024),Image.Resampling.LANCZOS); target=io.BytesIO(); image.quantize(colors=256,method=Image.Quantize.FASTOCTREE).save(target,format='PNG',optimize=True); data=target.getvalue();k=len(self.d['images']);self.d['images'].append({'bufferView':self.view(data),'mimeType':'image/png'});j=len(self.d['textures']);self.d['textures'].append({'source':k});self.textures[key]=j
            p['baseColorTexture']={'index':self.textures[key]}
        j=len(self.d['materials']);self.d['materials'].append(m);return j
    def mesh(self,name,pos,norm,uv,idx,material):
        used,remap=np.unique(idx,return_inverse=True);pos=pos[used];norm=norm[used];uv=uv[used] if uv is not None else None;idx=remap.reshape(idx.shape)
        attrs={'POSITION':self.acc(pos,'VEC3'),'NORMAL':self.acc(norm,'VEC3')}
        if uv is not None:attrs['TEXCOORD_0']=self.acc(uv,'VEC2')
        i=len(self.d['meshes']);self.d['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'indices':self.acc(idx.reshape(-1,1),'SCALAR'),'material':material}]});j=len(self.d['nodes']);self.d['nodes'].append({'name':name,'mesh':i});self.d['scenes'][0]['nodes'].append(j)
    def add(self,s,head=False,clothes=False):
        arms,grip=pose(s)
        for node in s[2]['nodes']:
            if 'mesh' not in node:continue
            name=node['name']
            if clothes and 'Hood' in name:continue
            skin=s[2]['skins'][node['skin']]
            for prim in s[2]['meshes'][node['mesh']]['primitives']:
                attrs=prim['attributes'];pos=array(s,attrs['POSITION']);norm=array(s,attrs['NORMAL']);uv=array(s,attrs['TEXCOORD_0']);idx=array(s,prim['indices']).reshape(-1,3)
                if head and 'Superhero' in name:idx=idx[(pos[idx,1]>=1.49).all(axis=1)]
                if not len(idx):continue
                if clothes:
                    joints=array(s,attrs['JOINTS_0']);weights=array(s,attrs['WEIGHTS_0']);original=pos.copy();originalnorm=norm.copy()
                    for pivot,r,desc in arms.values():
                        mask=np.isin(joints,[j for j,n in enumerate(skin['joints']) if n in desc]);w=(mask*weights).sum(axis=1)[:,None];pos+=w*((original-pivot)@r.T+pivot-original);norm+=w*(originalnorm@r.T-originalnorm)
                    norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-8)
                self.mesh(name,pos,norm,uv,idx,self.material(s,prim['material']))
        return grip
    def box(self,name,center,size,color):
        # A deliberately simple placeholder weapon, native mesh geometry.
        p=[];n=[];idx=[]
        for axis in range(3):
            others=[i for i in range(3) if i!=axis]
            for sign in [-1,1]:
                start=len(p);normal=[0,0,0];normal[axis]=sign
                for u,v in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                    q=np.array(center,float);q[axis]+=sign*size[axis]/2;q[others[0]]+=u*size[others[0]]/2;q[others[1]]+=v*size[others[1]]/2;p.append(q);n.append(normal)
                idx.extend([[start,start+1,start+2],[start,start+2,start+3]])
        m=len(self.d['materials']);self.d['materials'].append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.35,'roughnessFactor':.5}});self.mesh(name,np.array(p),np.array(n),None,np.array(idx),m)
    def weapon(self,kind,grip):
        x,y,z=grip;z+=.025
        self.box('weapon_grip',[x,y,z],[.032,.18,.032],[.19,.12,.07,1])
        if kind=='sword':
            self.box('weapon_blade',[x,y-.42,z],[.065,.68,.02],[.67,.77,.81,1]);self.box('weapon_guard',[x,y-.06,z],[.23,.035,.04],[.75,.58,.25,1])
        else:
            self.box('weapon_staff',[x,y+.12,z],[.035,1.65,.035],[.32,.19,.09,1]);self.box('weapon_crystal',[x,y+.99,z],[.10,.18,.10],[.3,.75,.79,1])
    def save(self,path):
        self.d['buffers'][0]['byteLength']=len(self.b);j=json.dumps(self.d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);self.b+=b'\0'*((-len(self.b))%4)
        path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(self.b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(self.b),0x004e4942)+self.b)

head=source(BASE,'Superhero_Female_FullBody.gltf','Godot - UE')
hair=source(BASE,'Hair_Long.gltf','Rigged to Head Bone/glTF')
folder=ROOT/'assets/modular-proof';folder.mkdir(exist_ok=True)
for armor in ['ranger','peasant']:
    outfit=source(OUT,'Female_'+armor.title()+'.gltf','/Outfits/')
    for weapon in ['sword','staff']:
        b=Builder();b.add(head,head=True);b.add(hair);grip=b.add(outfit,clothes=True);b.weapon(weapon,grip);path=folder/(armor+'-'+weapon+'.glb');b.save(path);print(path.name,path.stat().st_size)
(folder/'LICENSE.txt').write_text(BASE.read('Universal Base Characters[Standard]/License_Standard.txt').decode()+ '\n'+OUT.read('Modular Character Outfits - Fantasy[Standard]/License_Standard.txt').decode())
