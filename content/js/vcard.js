//     ____________
//    |            |    A Javascript parser for vCards
//    |  vCard.js  |    Created by Mattt Thompson, 2008
//    |            |    Released under the MIT License
//     ̅̅̅̅̅̅̅̅̅̅̅̅

// Adding Javascript 1.6 Compatibility
if(!Array.prototype.forEach){Array.prototype.forEach=function(d,c){c=c||this;for(var b=0,a=this.length;b<a;b++){d.call(c,this[b],b,this)}}}if(typeof Prototype!="undefined"||!Array.prototype.map){Array.prototype.map=function(d,c){c=c||this;var e=[];for(var b=0,a=this.length;b<a;b++){e.push(d.call(c,this[b],b,this))}return e}}if(typeof Prototype!="undefined"||!Array.prototype.filter){Array.prototype.filter=function(d,c){c=c||this;var e=[];for(var b=0,a=this.length;b<a;b++){if(d.call(c,this[b],b,this)){e.push(this[b])}}return e}}["forEach","map","filter","slice","concat"].forEach(function(a){if(!Array[a]){Array[a]=function(b){return this.prototype[a].apply(b,Array.prototype.slice.call(arguments,1))}}});Date.ISO8601PartMap={Year:1,Month:3,Date:5,Hours:7,Minutes:8,Seconds:9};Date.matchISO8601=function(a){return a.match(/^(\d{4})(-?(\d{2}))?(-?(\d{2}))?(T(\d{2}):?(\d{2})(:?(\d{2}))?)?(Z?(([+\-])(\d{2}):?(\d{2})))?$/)};Date.parseISO8601=function(e){var b=this.matchISO8601(e);if(b){var a=new Date,c,d=0;for(var f in this.ISO8601PartMap){if(part=b[this.ISO8601PartMap[f]]){a["set"+f]((f=="Month")?parseInt(part)-1:parseInt(part))}else{a["set"+f]((f=="Date")?1:0)}}if(b[11]){d=(parseInt(b[14])*60)+parseInt(b[15]);d*=((parseInt[13]=="-")?1:-1)}d-=a.getTimezoneOffset();a.setTime(a.getTime()+(d*60*1000));return a}};

vCard = {
  initialize: function(_input){
    var list = [];
    this.parse(_input, list);
    return list;
  },
  parse: function(_input, list) {
    var fields = {};
    var bParsing = false;
    var regexps = {
      begin: /^BEGIN:VCARD/i,
      end: /^END:VCARD/i,
      simple: /^(prodid|version|fn|title|org|note)\:(.+)$/i,
      complex: /^([^\:\;]+);([^\:]+)\:(.+)$/,
      key: /item\d{1,2}\./,
      key2: /(\;charset=.+)\:/i,
      properties: /((type=)?(.+);?)+/
    }

    var lines = _input.split(/\r?\n/);
    for (n in lines) {
      line = lines[n];
      if(regexps['begin'].test(line))
      {
        bParsing = true;
        continue;
      }
      if (!bParsing) {
        continue;
      }
      if(regexps['end'].test(line))
      {
        list.push(fields);
        bParsing = false;
        continue;
      }
      if (regexps['key2'].test(line)) {
        results = line.match(regexps['key2']);
        line = line.replace(results[1], '');
      }
      if(regexps['simple'].test(line))
      {
        results = line.match(regexps['simple']);
        key = results[1].toLowerCase();
        value = results[2];
        fields[key] = value;
      }

      else if(regexps['complex'].test(line))
      {
        results = line.match(regexps['complex']);
        key = results[1].replace(regexps['key'], '').toLowerCase();

        //properties = results[2].split(';');
        //properties = Array.filter(properties, function(p) { return ! p.match(/[a-z]+=[a-z]+/) });
        //properties = Array.map(properties, function(p) { return p.replace(/type=/g, '') });

        //type = properties.pop() || 'default';
        type = results[2];
        type = type.toLowerCase();

        value = results[3];
        value = /;/.test(value) ? [value.split(';')] : value;

        fields[key] = fields[key] || {};
        fields[key][type] = fields[key][type] || [];
        fields[key][type] = fields[key][type].concat(value);
      }
    }
  }
}