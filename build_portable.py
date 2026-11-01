"""Build a fresh portable ZIP from the explicit tracked source manifest."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import zipfile

HERE=Path(__file__).resolve().parent


def build(destination,runtime_source,node_source):
    if destination.exists():
        raise FileExistsError('Use a fresh output directory')
    manifest=json.loads((HERE/'SOURCE-MANIFEST.json').read_text(encoding='utf-8'))
    app=destination/'battle-peek'
    app.mkdir(parents=True)
    shutil.copy2(HERE/'SOURCE-MANIFEST.json',app/'SOURCE-MANIFEST.json')
    for name,digest in manifest['files'].items():
        source=HERE/name
        if hashlib.sha256(source.read_bytes()).hexdigest()!=digest:
            raise ValueError('Source file changed: '+name)
        target=app/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,target)
    shutil.copytree(runtime_source/'runtime',app/'runtime')
    shutil.copytree(runtime_source/'vendor',app/'vendor',ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copy2(node_source,app/'runtime/node.exe')
    (app/'runtime/python311._pth').write_text('python311.zip\nDLLs\n..\n../vendor\n../collector\n',encoding='ascii')
    files={p.relative_to(app).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in app.rglob('*') if p.is_file()}
    metadata={'schema':'czn-battle-peek-release-v1','version':'0.1.0-preview','files':files,
        'containsBattleCaptures':False,'containsGameExecutable':False,'uploadsAutomatically':False}
    (destination/'build-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    archive=destination.parent/(destination.name+'.zip')
    with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
        for name in files:
            z.write(app/name,'battle-peek/'+name)
    result={'path':str(archive),'bytes':archive.stat().st_size,'SHA256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(files)}
    (destination/'release.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('destination',type=Path)
    p.add_argument('--runtime-source',type=Path,required=True,help='Existing collector portable folder with runtime and vendor')
    p.add_argument('--node-source',type=Path,required=True,help='Existing reviewed Node.js 24.13.0 x64 executable')
    a=p.parse_args()
    build(a.destination.resolve(),a.runtime_source.resolve(),a.node_source.resolve())
