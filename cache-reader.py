"""One extra existing Map key. No query, loader, getter or game method added."""
import json
import re


def extend_existing_cache_reader(prepare):
    def build(identity,request):
        source=prepare(identity,request)
        match=re.search(r'^const gameCaptureExpression=(.*);$',source,re.M)
        expression=json.loads(match[1])
        old='for(const key of [98,122,323])'
        if expression.count(old)!=1:
            raise ValueError('现有缓存读取入口不唯一，停止生成')
        expression=expression.replace(old,'for(const key of [81,98,122,323])').replace(
            "scope:'three-declared-powerstep-keys'","scope:'four-declared-powerstep-keys'")
        return source[:match.start(1)]+json.dumps(expression,ensure_ascii=True,separators=(',',':'))+source[match.end(1):]
    return build
