YUI.add("translator", function(Y) {

    function Translator() {
        this._module = "translator";
        this._lang   = Y.Intl.getLang("translator");
    }

    Translator.prototype = {
        constructor : Translator,
        get_string : function(key, data) {
            var source = Y.Intl.get(this._module, key, this._lang);
            if (typeof(data) == 'object') {
                return Y.Lang.sub(source, data);
            }
            return source;
        }
    }

    Y.Translator = Translator;

}, "0.0.0", {lang: ["zh-TW"], requires: ["intl", "lang"]}); 
