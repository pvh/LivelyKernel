/**
 * defaultconfig.js.  System default configuration. Reads config.js
 *
 * Note that if the files localconfig.json and/or localconfig.js can be found,
 * those will be read immediately after this one, thus allowing any of these settings
 * to be overridden to adapt a local Lively installation.
 */

(function setupUserAgent(Global) {

var webKitVersion = (function() {
    if (!Global.navigator) return 0;
    var match = Global.navigator.userAgent.match(/.*AppleWebKit\/(\d+).*/);
    return match ? parseInt(match[1]) : 0;
})();

var isRhino = !Global.navigator || Global.navigator.userAgent.indexOf("Rhino") > -1,
    isMozilla = Global.navigator && Global.navigator.userAgent.indexOf("Mozilla") > -1,
    isChrome = Global.navigator && Global.navigator.userAgent.indexOf("Chrome") > -1,
    isOpera = Global.navigator && Global.navigator.userAgent.indexOf("Opera") > -1,
    isIE = Global.navigator && Global.navigator.userAgent.indexOf("MSIE") > -1,
    isMobile = Global.navigator && Global.navigator.userAgent.indexOf("Mobile") > -1,
    fireFoxVersion = Global.navigator &&
    (Global.navigator.userAgent.split("Firefox/")[1] ||
     Global.navigator.userAgent.split("Minefield/")[1]); // nightly

Global.UserAgent = {
    // Newer versions of WebKit implement proper SVGTransform API, with
    // potentially better performance. Scratch that, lets make it more
    // predictable:
    usableTransformAPI: webKitVersion < 0, //webKitVersion >= 525,
    usableDropShadow: webKitVersion >= 525,
    canExtendBrowserObjects: !isRhino, // Error, document
    usableOwnerSVGElement: !isRhino && !isMozilla,

    // WebKit XMLSerializer seems to do weird things with namespaces
    usableNamespacesInSerializer: true, //webKitVersion <= 0,

    usableXmlHttpRequest: !isRhino,

    usableHTMLEnvironment: !isRhino,

    webKitVersion: webKitVersion,

    isRhino: isRhino,

    isMozilla: isMozilla,

    isChrome: isChrome,

    isOpera: isOpera,

    isIE: isIE,

    fireFoxVersion: fireFoxVersion ? fireFoxVersion.split('.') : null,

    isWindows: Global.navigator && Global.navigator.platform == "Win32",

    isLinux: Global.navigator && Global.navigator.platform.startsWith("Linux"),

    isMacOS: Global.navigator && Global.navigator.platform.startsWith("Mac"),

    isTouch: false,

    isMobile: isMobile,

    touchIsMouse: false,

    isNodejs: (Global.process && !!Global.process.versions.node)
            || Global.navigator.userAgent.indexOf("Node.js") !== -1,

    isWorker: typeof importScripts !== 'undefined'
}

})(typeof Global !== 'undefined' ? Global : window);


(function savePreBootstrapConfig() {
    Global.ExistingConfig = Global.Config;
    if (Global.ExistingConfig) {
        delete Global.ExistingConfig._options;
    }
})();

Global.Config = {

    _options: {},

    addOption: function(option) {
        // option: {name: STRING, value: OBJECT, docString: STRING, group: STRING, type: STRING, [get: FUNCTION,] [set: FUNCTION]}
        if (arguments.length > 1) { // old form of defining
            // args: name, value, docString, group, type
            return this.addOption({
                name: arguments[0],
                value: arguments[1],
                docString: arguments[2],
                group: arguments[3],
                type: arguments[4]
            });
        }
        var name = option.name, value = option.value,
            type = option.type, docString = option.docString,
            group = option.group;
        if (option.name === '_options') {
            throw new Error('Cannot set Config._options! Reserved!');
        }

        if (!option.hasOwnProperty('value') && option.get) {
            if (typeof option.get === 'object' && option.get.type === 'function' && option.get.code) {
                try {
                    option.get = eval("(" + option.get.code + ")\n\n//# sourceURL=lively.Config.get."+name)
                } catch (e) {
                    console.error("Cannot initialize lively.Config." + name + ":\n" + e);
                }
            }
            value = option.get();
        }

        if (typeof option.set === 'object' && option.set.type === 'function' && option.set.code) {
            try {
                option.set = eval("(" + option.set.code + ")\n\n//# sourceURL=lively.Config.set."+name)
            } catch (e) {
                console.error("Cannot initialize lively.Config." + name + ":\n" + e);
            }
        }

        if (!type && typeof value !== 'undefined') {
            if (Object.isRegExp(value)) type = 'RegExp'
            else if (Object.isArray(value)) type = 'Array'
            else if (typeof value === 'string') type = 'String'
            else if (typeof value === 'number') type = 'Number'
            else if (typeof value === 'function') type = 'Function'
        }

        this._options[name] = {
            doc: docString,
            get: option.get,
            set: option.set,
            type: type,
            default: value,
            group: group
        }

        if (!option.set) this[name] = value;
        else option.set(value);
    },

    hasOption: function(name) {
        return !!this._options[name];
    },

    hasDefaultValue: function(name) {
        var spec = this._options[name];
        return spec && spec.default === this[name];
    },

    addOptions: function(/*group - options pairs*/) {
        // - group is a string that should map to a lively namespace
        // - options are an array of arrays
        //   each sub array should at least have
        //   [0] option name
        //   [1] option value
        //   optional:
        //   [2] docString
        //   [3] type
        //   alernative: spec option as expected by addOption
        var config = this, args = Array.from(arguments);
        for (var i = 0; i < args.length; i += 2) {
            var group = args[i], options = args[i+1];
            options.forEach(function(optionSpec) {
                if (Object.isArray(optionSpec)) {
                    optionSpec[4] = optionSpec[3]; // type, optional
                    optionSpec[3] = group;
                    config.addOption.apply(config, optionSpec);
                } else {
                    if (!optionSpec.group) optionSpec.group = group;
                    config.addOption.call(config, optionSpec);
                }
            });
        }
    },

    urlQueryOverride: function() {
        if (Global.UserAgent.isNodejs) return;
        var queries = document.URL.toString().toQueryParams();
        for (var name in queries) {
            if (!this.hasOption(name)) continue;
            var value = queries[name];
            if (value === "false") value = false;
            if (this.get(name) === value) continue;
            console.log('Overriding lively.Config.' + name + ' with ' + value);
            this.set(name, value);
        }
    },

    loadUserConfigModule: function(optUsername) {
        if (!this.get("loadUserConfig")) return;
        var userName = optUsername || this.get('UserName');
        if (!userName || userName === "undefined") return;
        var userConfigModule = Strings.format('users.%s.config', userName);
        lively.require(userConfigModule).toRun(this.urlQueryOverride.bind(this));
    },

    set: function(name, value) {
        var spec = this._options[name];
        if (!spec) throw new Error('Trying to set unknown option lively.Config.' + name);
        return spec && spec.set ? spec.set.call(null, value) : (this[name] = value);
    },

    get: function(name, ignoreIfUndefinedOption) {
        var spec = this._options[name];
        if (!ignoreIfUndefinedOption && !spec) throw new Error('Trying to get unknown option lively.Config.' + name);
        return spec && spec.get ?
            spec.get.call() : (typeof this[name] === "function" ? this[name].call() : this[name]);
    },

    lookup: function(name) {
        // retrieve the Config value. If its a function: don't call it.
        var spec = this._options[name];
        return spec && spec.get ? this.get(name) : this[name];
    },

    add: function(name, value) {
        var arr = this.get(name);
        if (!Object.isArray(arr)) {
            throw new Error('Trying to add to a non-array lively.Config.' + name);
        }
        return arr.push(value);
    },

    // helper methods
    bootstrap: function(LivelyLoader, JSLoader, PreBootstrapConfig, thenDo) {
        var Config = this, url = Config.codeBase + "lively/config.json";

        // 1. load core/lively/config.json
        JSLoader.loadJSON(url, function(err, configData) {
            if (err) thenDo(err, null);
            else setOptionsFromConfigJSONData(configData, function(err) {
                // 2. load core/lively/localconfig.js(on)
                if (err) thenDo(err, null);
                else loadConfigCustomization(thenDo);
            });
        });

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        function setOptionsFromConfigJSONData(configData, next) {
            try {
                var def = Object.keys(configData).reduce(function(def, group) {
                    return def.concat([group, configData[group]]); }, []);
                Config.addOptions.apply(Config, def);
                setContextSpecificOptions(Config, Global.UserAgent, PreBootstrapConfig || {});
            } catch(e) { next(e, null); return; }
            next(null);
        }

        function loadConfigCustomization(thenDo) {
            loadLocalconfig(function(err) { setConfigOptionsFromURL(); thenDo(); });
        }

        function loadLocalconfig(thenDo) {
            try {
                JSLoader.loadJs(Config.rootPath + 'core/lively/localconfig.js', thenDo);
            } catch(e) { console.log('localconfig.js could not be loaded.'); thenDo(e); }
        }

        function setConfigOptionsFromURL() {
            try {
                lively.Config.urlQueryOverride();
            } catch(e) { console.log('Config customization via URL query could not be applied.'); }
        }
    },


    getDocumentDirectory: function() {
        // used in various places
        return JSLoader.currentDir();
    },

    location: (function setupLocation() {
        if (typeof document !== "undefined") return document.location;
        var url = JSLoader.currentDir(),
            match = url.match(/(^[^:]+:)[\/]+([^\/]+).*/),
            protocol = match[1],
            host = match[2];
        return {
            toString: function() { return url },
            valueOf: function() { return url },
            protocol: protocol,
            host: host
        }
    })(),

    // debugging
    allOptionNames: function() {
        return Properties.own(this)
               .pushAll(Properties.own(this._options))
               .uniq()
               .withoutAll(this._nonOptions)
               .reject(function(ea) { return ea.startsWith('__') || ea.startsWith('$$') });
    },

    manualOptionNames: function() {
        return this.allOptionNames()
           .withoutAll(Properties.own(this._options));
    },

    toString: function() { return 'lively.Config' },

    displayWarning: function() {
        var warn = lively.$('<div/>');
        warn.text('Currently optimized loading is disabled. '
                 + 'It can therefore take a bit longer loading a world. '
                 + 'We will soon fix this issue.');
        warn.css({position: 'absolute',
                  left: '20px',
                  top: '20px',
                  color: 'orange',
                  'font-family': 'sans-serif',
                  "font-size": "20px"});
        warn.appendTo('body');
        setTimeout(function() { warn.remove(); }, 4000);
    },

    inspect: function() {
        // gather all groups
        var groups = {}, groupNames = [], config = this;

        config.allOptionNames().forEach(function(name) {
            var option = config._options[name],
                groupName = (option && option.group) || '- undefined group -',
                group = groups[groupName] = groups[groupName] || [],
                groupItem = [name, config.lookup(name, true)];
            if (option && option.doc) groupItem.push(option.doc);
            groupItem = groupItem.collect(function(ea) { return Strings.print(ea) });
            group.push(groupItem);
            groupNames.pushIfNotIncluded(groupName);
        });

        // print each group
        var groupStrings = groupNames.sort().collect(function(groupName) {
            var group = groups[groupName],
                options = group.sortBy(function(option) { return option[0] }),
                optionsString = options.collect(function(option) {
                    return '[' + option.join(', ') + ']' }).join(",\n    ");
            return Strings.print(groupName) + ", [\n    " + optionsString + ']';
        });

        return 'lively.Config:\n  [' + groupStrings.join(',\n\n  ') + ']';
    }

};

(function finishCoreConfigDefinition(Config) {
    // All the methods and properties defined in Config at this point are for
    // managing/reading/writing the Config itself and should not be considered as
    // Config options
    if (Config._nonOptions) return;
    var knownNoOptions = ['_nonOptions', "doNotCopyProperties", "doNotSerialize", "attributeConnections", "finishLoadingCallbacks"];
    Config._nonOptions = Object.keys(Config).concat(knownNoOptions);
})(Global.Config);


(function addSystemConfigOptions(Config, UserAgent) {

    var browserPrefix = (function() {
        if (UserAgent.fireFoxVersion) return 'moz';
        if (UserAgent.isIE) return 'ms';
        if (UserAgent.isOpera) return 'o';
        if (UserAgent.webKitVersion) return 'webkit';
        return '';
    })(), browserPrefixDash = browserPrefix ? '-' + browserPrefix + '-' : '';

    Config.addOptions(
        "lively.morphic.Rendering", [
            ["browserPrefix", browserPrefix, "Prefix used for accessing browser specific features."],
            ["html5CssPrefix", browserPrefixDash],
            ["html5TransformProperty", UserAgent.isOpera ? 'OTransform' : (browserPrefixDash + 'transform')],
            ["html5TransformOriginProperty", UserAgent.isOpera ? 'OTransformOrigin' : (browserPrefixDash + 'transform-origin')]
        ]);

})(Global.Config, Global.UserAgent);

(function addOptionsFromPreBootstrapConfig(ExistingConfig, NewConfig) {
    if (!ExistingConfig) return;
    for (var name in ExistingConfig) {
        var value = ExistingConfig[name];
        if (NewConfig.hasOption(name)) {
            NewConfig.set(name, value)
        } else {
            NewConfig.addOption(name, value, null, 'pre-bootstrap config option');
        }
    }
    delete Global.ExistingConfig;
})(Global.ExistingConfig, Global.Config);

(function addConfigToLivelyNS() {
    var lively = Global.lively = Global.lively || {};
    lively.Config = Global.Config;
})();

function setContextSpecificOptions(Config, UserAgent, ExistingConfig) {
    // support for loading from blob urls, e.g. in workers
    // note that workers can also get the location spec passed in as an option so
    // that blob parsing shouldn't be necessary. Also, in Firefox blob parsing
    // doesn't work.
    if (Config.location.protocol.indexOf('blob') > -1) {
        var isEncoded = !!Config.location.pathname.match(/https?%3A/);
        var decoded = Config.location.pathname;
        if (isEncoded) decoded = decodeURIComponent(decoded);
        var urlMatch = decoded.match(/([^:]+:)\/\/([^\/]+)(.*)/);
        if (urlMatch) {
            Config.location = {
                protocol: urlMatch[1],
                host: urlMatch[2],
                pathname: urlMatch[3],
                toString: function() {
                    return this.protocol + '//' + this.host + this.pathname;
                }
            }
        }
    }

    var host = Config.location.host,
        protocol = Config.location.protocol,
        url = Config.location.toString();

    Config.addOptions(
        "lively.Network", [
            ["proxyURL", protocol + "//" + host + "/proxy", "URL that acts as a proxy for network operations"]
        ],

        "server.nodejs", [
            ["nodeJSURL", Config.location.protocol + "//" + Config.location.host + "/nodejs", 'Base URL of Lively subservers. Computed at system start.']
        ],

        "lively.morphic", [
            ["modulesBeforeWorldLoad", ["lively.morphic.HTML"].concat(UserAgent.isMobile ? ["lively.morphic.MobileInterface"] : []), "evaluated before all changes"]
        ],

        "lively.ModuleSystem", [
            ["codeBase", ExistingConfig.codeBase || Config.getDocumentDirectory()]
        ],

        "codedb", [
            ["couchDBURL", Config.location.protocol + "//" + Config.location.host + "/couchdb", "Deprecated."]
        ],

        "lively.morphic.Events", [
            ["usePieMenus", UserAgent.isTouch]
        ],

        "lively.morphic.StyleSheets", [
          ["baseThemeStyleSheetURL", (ExistingConfig.codeBase || Config.getDocumentDirectory()) + "styles/base_theme.css", "The base theme CSS file location"],
          ["ipadThemeStyleSheetURL", (ExistingConfig.codeBase || Config.getDocumentDirectory()) + "styles/ipad_theme.css", "The ipad theme CSS file location"]
        ]);
}
