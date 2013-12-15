var sourceBaseUrl = "js/";
var sources = [
   "prettify.js",
    "lang-js.js"
 ];
  /*    
   "lang-php.js",
   "lang-js_my.js",
   "lang-yaml.js",
   "lang-css.js"

  "lang-css.js",
      "lang-go.js",
      "lang-hs.js",
      "lang-lisp.js",
      "lang-lua.js",
      "lang-ml.js",
      "lang-proto.js",
      "lang-scala.js",
      "lang-sql.js",
      "lang-wiki.js",
      "lang-vhdl.js",
      "lang-vb.js",
      "lang-proto.js",*/
 
for (var i = 0; i < sources.length; ++i) {
    document.write(
        "<script src=\"" + sourceBaseUrl + sources[i] + "\"><\/script>");
}

function printCode(){
    if( typeof(prettyPrint)=="undefined" ){
        setTimeout("printCode();",500);
    }
    else{
        prettyPrint();
    }

}
printCode();
