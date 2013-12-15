/**
* 1. zIndex manager
* 2. YUI use manager
* 3. utility
* 4. config, setting
*/
YUI.add("easyYUI_core", function (Y) {
    var obj = {},
        attrs = {};

    attrs.env = {
        value: "production" //alpha, beta...
    };

    attrs.zIndex = {
        value: 100
    };

    /**
    * How many milliseconds we will execute something.
    *
    * @property time
    * @type {Int}
    */
    attrs.timeToExecute = {
        value: 7000
    };

    /**
    * How many milliseconds we will finish action.
    *
    * @property durationToAnimation
    * @type {Int}
    */
    attrs.durationToFinish = {
        value: 700
    };

    /**
     * YUI modules
     * This arrtibute will be used in YUI().use('???
     */
    attrs.modules = {//{{{
        value: "",
        setter: function (val) {
            var m = this.get('modules'),
                i = 0,
                n;
            if (!Y.Lang.isArray(val)) {
                val = val.split(/,/);
            }
            n = val.length;
            for (i; i < n; i++) {
                m.push(val[i]);
            }
            return m;
        }
    };//}}}

    obj.initializer = function () {
    };

    /**
     * Remove script code : while , it is secure issue.
     */
    obj.getAJAXResponse = function (text) {
        if (text.substr(0, 6) === "while(") {
            text = text.replace(/^[^\n\r]+\n/, '');
        }
        return text;
    };

    /**
     * get css zIndex , auto increment
     */
    obj.getZIndex = function () {
        var zIndex = this.get('zIndex');
        zIndex++;
        this.set('zIndex', zIndex);
        return zIndex;
    };



    /**
    * add new parameter to build a new url.
    * Auto add ? or & ,   Auto replace the same key
    **/
    obj.addUrlParameter = function (url, obj, isReplace) {
        var isFirst = true, reg;
        if (typeof(replace) == "undefined") {
            isReplace = true;
        }
        if (url.match(/\?/)) {
            isFirst = false;
        }

        for (pro in obj) {
            if (obj.hasOwnProperty(pro)) {
                if (isFirst) {
                    url += "?";

                    isFirst = false;
                } else {
                    url += "&";

                }

                reg = new RegExp("([&\?])" + pro + "=[^&]*", "g");
                if (isReplace == true && url.match(reg)) {
                    url = url.replace(reg, RegExp.$1 + pro + "=" + obj[pro]);
                } else {
                    url += pro + "=" + obj[pro];
                }
            }
        }

        url = url.replace(/&{2,}/g, '&');
        return url;
    };

    /**
     * sprintf
     *
     * @method sprintf
     */
    obj.sprintf = function (message, param) {/*{{{*/
        var msg = message;
        var REG, i, n;
        REG = /\{[0-9]+\}/;
        if(param) {
            n = param.length;
            for (i=0; i<n ;i++) {
                msg = msg.replace(REG, param[i]);
            }
        }
        return msg;
    };/*}}}*/

    /**
    * Convert full width characters to half width characters
    * @method convertFullwidthChars
    * @param {String} the string to convert
    * @param {String} the converted string
    */
    obj.convertFullwidthChars = function (str) {
        if (!Y.Lang.isString(str)) {
            return str;
        }
        return str.replace(/[\uff01-\uff5e]/g,
            function (a) {
                return String.fromCharCode(a.charCodeAt(0)-65248);
            }).replace(/\u3000/g," ");
    };

    /**
     * return false , if user input is not a number 0~9 , But allow user keyin [enter, <F5>, backspace]
     * keyCode: 37 left arrow, 39 right arrow, 46 delete, 36: home, 35 end, 8 backspace, 9 tab
     * We could add "ime-mode: disable"  style that could disable input source of chinese only in IE
     * @method isNumberKeyCode
     */
    obj.isNumberKeyCode = function (event) {/*{{{*/
        var key = event.keyCode;
        var val = String.fromCharCode(key);

        var acceptCode = [ 8, 9, 13, 36, 35, 37, 39, 46, 116, 96, 97 ,98, 99, 100, 101, 102, 103, 104, 105];
        //Y.log("keyCode = " + key + " value = " + val + "  which = " + event.which , "info");
        //Y.log(event, "info");

        if (event.ctrlKey) {
            return true;
        }

        if (event.metaKey) {
            return true;
        }

        if (key === 13) {
            return false;
        }

        if (event.shiftKey && key >=48 && key<= 57) {
            return false;
        }

        if (Y.Array.indexOf(acceptCode, key) === -1  && !val.match(/[0-9]/)) {
            return false;
        }
        return true;
    };/*}}}*/



    Y.namespace('easyYUI').core = Y.Base.create('easyYUI_core', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );

    obj = null;
    attrs = null;
    
    Y.namespace('easyYUI_obj').core = new Y.easyYUI.core();

    Y.log("Load YUI Module [easyYUI_core] success.", "info")
}, '', {requires: ['base', 'datatype-number', 'lang']});
