﻿if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g,'');
    };
}

if (!Array.isArray) {
    Array.isArray = function (vArg) {
      return Object.prototype.toString.call(vArg) === "[object Array]";
    };
}

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
        "use strict";
        if (this == null) {
            throw new TypeError();
        }
        var t = Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (arguments.length > 1) {
            n = Number(arguments[1]);
            if (n != n) { // shortcut for verifying if it's NaN
                n = 0;
            } else if (n != 0 && n != Infinity && n != -Infinity) {
                n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    }
}

require.config({
    paths: {
        'd3': 'https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.12/d3.min'
    },
    shim: {
        'd3': {
            exports: 'd3'
        }
    }
});

require(['historyview', 'd3'], function (HistoryView, d3) {
      historyView = new HistoryView({name: "test"});
    historyView.render(d3.select(".container"));
    setInterval(function() {
        var lastJson
        d3.text("/status.json", function(error, text) {
            if (error) return console.warn(error);
            var history = JSON.parse(text);
            historyView.update(history);
        });    
    }, 1000);

});