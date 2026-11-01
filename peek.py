"""Local live hints using the unchanged collector and isolated offline engine."""
from pathlib import Path
import argparse
import html
import json
import os
import queue
import subprocess
import sys
import threading
import time
import uuid
import webbrowser

HERE=Path(__file__).resolve().parent
ROOT=HERE
COLLECTOR=ROOT/'collector'
PORTABLE=ROOT
sys.path[:0]=[str(COLLECTOR),str(PORTABLE/'vendor')]
from native_host import capture,discover,active_profile,save
import native_host
import importlib.util
_cache_spec=importlib.util.spec_from_file_location('peek_cache_reader',HERE/'cache-reader.py')
_cache_module=importlib.util.module_from_spec(_cache_spec)
_cache_spec.loader.exec_module(_cache_module)
native_host.prepare_source=_cache_module.extend_existing_cache_reader(native_host.prepare_source)


class ForecastWorker:
    def __init__(self):
        self.process=subprocess.Popen([str(HERE/'runtime/node.exe') if (HERE/'runtime/node.exe').exists() else 'node','--max-old-space-size=2048',str(HERE/'forecast.mjs')],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(HERE/'engine-error.log').open('a',encoding='utf-8'),
            text=True,encoding='utf-8',bufsize=1)
        self.replies=queue.Queue()
        threading.Thread(target=self._read,daemon=True).start()

    def _read(self):
        for line in self.process.stdout:
            self.replies.put(line)
        self.replies.put(None)

    def request(self,request):
        self.process.stdin.write(json.dumps(request,ensure_ascii=True)+'\n')
        self.process.stdin.flush()
        try:
            line=self.replies.get(timeout=90)
        except queue.Empty:
            # Only the offline child is terminated; this is never the game host.
            self.process.kill()
            raise RuntimeError('离线计算超过90秒，已停止本地计算；本批提示作废')
        if line is None:
            raise RuntimeError('离线计算进程已退出，请查看 engine-error.log')
        response=json.loads(line)
        if not response['ok']:
            raise ValueError(str(response['error']))
        return response['result']

    def close(self):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()


def h(value):
    return html.escape(str(value))


def damage_text(row):
    if not row.get('ok',True):
        return '未能完整预测：'+str(row.get('blocked'))
    hits=row.get('damages',[])
    if not hits:
        return '本次结算无伤害记录（可能为技能或进入选择）'
    return '；'.join(f"{hit['cardName']} → 敌人ID {hit['target']}：{'暴击' if hit['crit'] else '不暴击'}，{hit['damage']} 伤害" for hit in hits)


def render(status,result=None,route=None):
    if result is None:
        save(HERE/'latest.json',{'available':False,'status':status})
    parts=['<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="2">',
        '<title>卡厄思抽牌与暴击提示</title><style>body{font:17px system-ui;background:#121826;color:#e8eefb;max-width:1150px;margin:32px auto;padding:0 24px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border-bottom:1px solid #35425a;text-align:left}small{color:#adbcd0}.notice{background:#263650;padding:16px;border-radius:10px}li{margin:8px 0}</style>',
        '<h1>抽牌与暴击提示</h1><p class="notice">'+h(status)+'</p>',
        '<p>操作后旧提示立即不再适用。切回脚本按 R 刷新；读取期间请停手。每行表示“现在先打这一张”，各行不是连续出牌结果。</p>']
    if result:
        parts.append(f"<p>第 {h(result['turn'])} 回合 · 生命 {h(result['hp'])} · 能量 {h(result['energy'])} · 已记录 {h(result['actionCount'])} 次操作</p>")
        parts.append('<h2>接下来普通抽牌的顺序</h2><small>这是当前牌堆顺序；过滤、插牌、洗牌、手牌上限和抽牌触发可能改变实际入手。连续操作的实际入手看下方路线预测。</small><ol>')
        for c in result.get('drawable',result['deck'])[:10]:
            parts.append('<li>'+h(c['name'])+' <small>ID '+h(c['id'])+'</small></li>')
        parts.append('</ol>')
        if not result['deck']:
            parts.append('<p>当前抽牌堆为空；不把弃牌堆顺序当作下一次洗牌结果。</p>')
        if result.get('forecastUnavailable'):
            parts.append('<p class="notice">'+h(result['forecastUnavailable'])+'</p>')
        parts.append('<h2>当前手牌</h2><p>'+h(' / '.join(f"{c['position']}. {c['name']}（{c['cost']}费）" for c in result['hand']))+'</p>')
        parts.append('<p>敌人位置：'+h(' / '.join(f"{m['position']}. ID {m['id']}，{m['hp']}血，{m['state']}" for m in result['monsters']))+'</p>')
        parts.append('<h2>现在打出的结算预测</h2><table><tr><th>卡牌</th><th>目标</th><th>结果</th><th>入手</th></tr>')
        for p in result['previews']:
            target=next((str(m['position']) for m in result['monsters'] if m['id']==p['target']),'无需指定')
            parts.append('<tr><td>'+h(p['card']['name'])+'</td><td>'+h(target)+'</td><td>'+h(damage_text(p))+'</td><td>'+h('、'.join(c['name'] for c in p.get('arrivals',[])))+'</td></tr>')
        parts.append('</table>')
        if result.get('enumerationError'):
            parts.append('<p>候选读取未完成：'+h(result['enumerationError'])+'</p>')
    if route:
        parts.append('<h2>按指定顺序连续打出的预测</h2><ol>')
        for p in route['steps']:
            parts.append('<li>'+h(damage_text(p))+'<br>入手：'+h('、'.join(c['name'] for c in p['arrivals']) or '无')+'<br>结算后手牌：'+h('、'.join(c['name'] for c in p['hand']))+'</li>')
        parts.append('</ol>')
        if route.get('stopped'):
            parts.append('<p>'+h(route['stopped'])+' '+h(route.get('blocked',''))+'</p>')
    parts.append('<p><small>本机试用版。规则和资源缺失时停止预测；不代替你出牌。牌名使用已有繁体中文表，找不到时显示资源编号。更新记录保存在同目录 runs。</small></p>')
    temporary=HERE/'latest.tmp'
    temporary.write_text(''.join(parts),encoding='utf-8')
    os.replace(temporary,HERE/'latest.html')


def parse_plan(text):
    result=[]
    for token in text.split():
        if token.lower()=='e':
            result.append({'endTurn':True})
        else:
            a,b=token.split(':')
            result.append({'hand':int(a),'target':int(b)})
    if not 1<=len(result)<=20:
        raise ValueError('请输入1至20步')
    return result


def refresh(worker):
    identity=discover()
    selected=active_profile(identity)
    folder=HERE/'runs'/uuid.uuid4().hex
    folder.mkdir(parents=True)
    # Each native read retains the existing ownership supervisor, unchanged.
    snap=capture(folder/'snapshot',identity,folder.name,'snapshot','snapshot')
    config=capture(folder/'config',identity,folder.name,'config','config')
    if snap['after']!=config['before'] or config['after']!=config['before']:
        raise ValueError('这次读取期间状态变了；本批提示作废。停手后按 R 重读')
    result=worker.request({'type':'load','snapshot':str(folder/'snapshot/data.json'),
        'config':str(folder/'config/data.json'),'profile':selected})
    receipt=json.loads((folder/'snapshot/receipt.json').read_text(encoding='utf-8'))
    result['capture']={'finishedUtc':receipt['finishedUtc'],'snapshotSHA256':receipt['dataSHA256'],
        'profileId':selected['id'],'folder':str(folder),'conditionalOnNoLaterGameActions':True}
    save(folder/'prediction.json',result)
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--watch',type=float,default=0,help='自动刷新间隔秒数，至少10秒；默认手动刷新')
    parser.add_argument('--offline',nargs=3,metavar=('SNAPSHOT','CONFIG','PROFILE'),help='只看已有快照，不连接游戏')
    parser.add_argument('--no-browser',action='store_true')
    parser.add_argument('--once',action='store_true',help='只刷新一次并保存提示')
    parser.add_argument('--self-check',action='store_true',help='只检查依赖和文件，不连接游戏')
    args=parser.parse_args()
    if args.self_check:
        import frida
        import psutil
        executable=HERE/'runtime/node.exe'
        node=subprocess.check_output([str(executable) if executable.exists() else 'node','--version'],text=True).strip()
        if sys.version_info[:2]!=(3,11) or frida.__version__!='17.23.2' or psutil.__version__!='7.1.3' or node!='v24.13.0':
            raise ValueError('运行环境与发行版本不一致')
        print(json.dumps({'passed':True,'python':sys.version.split()[0],'node':node,'frida':frida.__version__,'psutil':psutil.__version__,'gameAttached':False}))
        return
    if args.watch and args.watch<10:
        parser.error('自动刷新间隔至少10秒')
    worker=ForecastWorker()
    render('尚未读取。')
    if not args.no_browser:
        webbrowser.open((HERE/'latest.html').as_uri())
    print('抽牌与暴击提示：R 刷新；P 连续出牌预测；T 暂停/恢复自动刷新；Q 退出。',flush=True)
    print('读取期间请停手。提示只适用于本次快照，实际操作后请刷新。',flush=True)
    result=None
    interval=args.watch
    due=time.monotonic()
    command='r'
    try:
        if args.offline:
            snap,config,profile_file=args.offline
            result=worker.request({'type':'load','snapshot':snap,'config':config,'profile':json.loads(Path(profile_file).read_text(encoding='utf-8-sig'))})
            save(HERE/'latest.json',result)
            render('离线快照演示；不是当前游戏状态。',result)
            print('离线预测已写入 latest.html / latest.json。未连接游戏。')
            return
        if args.once:
            render('正在读取，请保持停手。')
            start=time.monotonic()
            result=refresh(worker)
            save(HERE/'latest.json',result)
            render(f'快照更新于 {time.strftime("%H:%M:%S")}；共 {time.monotonic()-start:.1f} 秒。已断开。操作后请重新刷新。',result)
            print('本批已完成、断开。')
            return
        import msvcrt
        while True:
            if command=='q':
                break
            try:
                if command=='r':
                    result=None
                    render('正在读取和计算，本批完成前请不要操作游戏。旧提示已撤下。')
                    worker.request({'type':'invalidate'})
                    start=time.monotonic()
                    result=refresh(worker)
                    save(HERE/'latest.json',result)
                    stamp=time.strftime('%H:%M:%S')
                    render(f'快照更新于 {stamp}；读取与计算共 {time.monotonic()-start:.1f} 秒。已断开，可操作游戏。',result)
                    print(f'{stamp} 更新完成，第 {result["turn"]} 回合；在网页查看提示。',flush=True)
                    due=time.monotonic()+interval
                elif command=='p':
                    interval=0
                    if result is None:
                        raise ValueError('请先刷新状态')
                    text=input('输入连续动作，如 1:1 2:0 1:2；牌位按每一步结算后的手牌，目标0=无需指定，E=结束回合：\n')
                    route=worker.request({'type':'plan','steps':parse_plan(text)})
                    save(HERE/'plan.json',route)
                    render('路线基于上次快照；如果游戏已操作，请先 R 刷新。自动刷新已暂停。',result,route)
                elif command=='t':
                    interval=0 if interval else (args.watch or 10)
                    due=time.monotonic()+interval
                    print('自动刷新已暂停' if not interval else f'自动刷新间隔 {interval:g} 秒；每次读取期间请停手。',flush=True)
            except Exception as error:
                interval=0
                result=None
                render('本批提示作废，自动刷新暂停：'+str(error))
                save(HERE/'last-error.json',{'message':str(error),'time':time.strftime('%Y-%m-%d %H:%M:%S')})
                print('未完成：'+str(error)+'；处理后按 R 重读。',flush=True)
            command=None
            while command is None:
                if msvcrt.kbhit():
                    command=msvcrt.getwch().lower()
                elif interval and time.monotonic()>=due:
                    command='r'
                else:
                    time.sleep(.1)
    except Exception as error:
        render('本批提示作废：'+str(error))
        save(HERE/'last-error.json',{'message':str(error),'time':time.strftime('%Y-%m-%d %H:%M:%S')})
        raise
    finally:
        if not (args.offline or args.once):
            render('脚本已退出，提示已失效。')
        worker.close()


if __name__=='__main__':
    main()
