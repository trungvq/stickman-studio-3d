import json
def d(o,ind=0,w=130):
    s=json.dumps(o,ensure_ascii=False,separators=(', ',': '))
    s=s.replace('{"','{ "').replace('"}',  '" }')
    if isinstance(o,dict) or isinstance(o,list):
        one=fmt1(o)
        if len(one)+ind<=w: return one
    else: return json.dumps(o,ensure_ascii=False)
    p=' '*(ind+2)
    if isinstance(o,dict):
        return '{\n'+',\n'.join(p+json.dumps(k)+': '+d(v,ind+2,w) for k,v in o.items())+'\n'+' '*ind+'}'
    return '[\n'+',\n'.join(p+d(v,ind+2,w) for v in o)+'\n'+' '*ind+']'
def fmt1(o):
    if isinstance(o,dict): return '{ '+', '.join(json.dumps(k)+': '+fmt1(v) for k,v in o.items())+' }' if o else '{}'
    if isinstance(o,list): return '['+', '.join(fmt1(v) for v in o)+']'
    return json.dumps(o,ensure_ascii=False)
