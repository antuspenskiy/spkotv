/*
 * HTRAF Toolkit
 * Copyright (c) 2011 Prometheus Research
 * Released under dual MIT/GPL license; see `LICENSE` for details
 * 
 * Version: 2.0.0b2
 */

(function() {

var attrs = null, scripts = document.getElementsByTagName('script');
function getAttr(attr, collection) {
    var c = collection || attrs;
    if(!c)
        return null;
    var attr = c.getNamedItem(attr);
    return attr ? attr.nodeValue:null;
}

for(var i = 0, l = scripts.length; i < l; i++) {
    var src = getAttr('src', scripts[i].attributes);
    if(src && /(^|\/)htraf.js$/.test(src)) {
        attrs = scripts[i].attributes;
        break;
    } 
}

var prefix = getAttr('src').replace(/(^|\/)htraf\.js$/, ''),
    _jqueryVersion = (window.$ || function() {return {}}).call().jquery 
                     || '0.0.0';
if(_jqueryVersion < '1.6.4')
    document.write('<script type="text/javascript" src="' 
        + prefix + '/lib/jquery.min.js"></script>');

if(!(window.JSON && window.JSON.parse && window.JSON.stringify))
    document.write('<script type="text/javascript" src="' 
        + prefix + '/lib/json2.min.js"></script>');

document.write('<script type="text/javascript" src="' 
    + prefix + '/lib/jquery.blockUI.min.js"></script>');

if(!window.$ || !window.$.Widget || !window.ui || !window.ui.position)
    document.write('<script type="text/javascript" src="' + prefix 
        + '/lib/jquery-ui.custom.min.js"></script>');

// HTRAF files
document.write('<script type="text/javascript" src="' 
    + prefix + '/jquery.htraf.js"></script>');
// document.write('<link rel="stylesheet" type="text/css" href="'
//     + prefix + '/htraf.css"/>');

})();
