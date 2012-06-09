/*
 * HTRAF Toolkit
 * Copyright (c) 2011 Prometheus Research
 * Released under dual MIT/GPL license; see `LICENSE` for details
 */

(function ($, undefined) {

// {{{ Setting up the base htraf parameters
    var HTRAF = window.HTRAF = {},
        selector = $.map(['htraf.js', 'jquery.htraf.js'],
            function (f) {
                return 'script[src="' + f + '"],script[src$="/' + f + '"]';
            }).join(','),
        $script = $(selector);

    HTRAF.prefix = $script.attr('src').replace(/(^|\/)htraf\.js$/, '');
    HTRAF.htsqlPrefix = $script.attr('data-htsql-prefix') || '';

    var htsqlVersion = ($script.attr('data-htsql-version') || '1').substr(0, 1);
    HTRAF.htsqlVersion = /1|2/.test(htsqlVersion) ? htsqlVersion : '1';

    HTRAF.addClass = $script.attr('data-htraf-class') || 'htraf';

    HTRAF.convert = {};
    HTRAF.convert.htsql = HTRAF.htsqlVersion == '1' ?
        function (data) {
            var ret = {headers:[], data:[]};
            $.each(data.meta[0].segment[0].element, function (i, element) {
                ret.headers.push({
                    title:element.title,
                    domain:element.domain
                });
            });

            $.each(data.data.branches[0], function (i, row) {
                ret.data.push(row.fields);
            });
            return ret;
        }
        :
        function (data) {
            if (data.meta instanceof Array) {
                return {
                    headers:data.meta,
                    data:data.data
                };
            }
            else {
                function _toMeta(domain, title) {
                    if (domain.type == 'list') {
                        return _toMeta(domain.item.domain, title)
                    }
                    else if (domain.type == 'record') {
                        var headers = [];
                        for (var k = 0; k < domain.fields.length; k++) {
                            var field = domain.fields[k];
                            headers = headers.concat(_toMeta(field.domain, field.header));
                        }
                        return headers;
                    }
                    else {
                        title = title || "";
                        domain = domain.type;
                        if (domain == 'integer' || domain == 'float' || domain == 'decimal') {
                            domain = 'number';
                        }
                        return [
                            { title:title, domain:domain }
                        ];
                    }
                }

                function _toRecord(domain, data) {
                    if (domain.type == 'list') {
                        data = (data && data.length > 0) ? data[0] : null;
                        return _toRecord(domain.item.domain, data[0]);
                    }
                    else if (domain.type == 'record') {
                        var record = [];
                        for (var k = 0; k < domain.fields.length; k++) {
                            var field = domain.fields[k];
                            record = record.concat(_toRecord(field.domain, data ? data[k] : null));
                        }
                        return record;
                    }
                    else {
                        return [data];
                    }
                }

                function _toList(domain, data) {
                    if (domain.type == 'list') {
                        var list = [];
                        if (data) {
                            for (var k = 0; k < data.length; k++) {
                                list.push(_toRecord(domain.item.domain, data[k]));
                            }
                        }
                        return list;
                    }
                    else {
                        return [_toRecord(domain.item.domain, data)];
                    }
                }

                return {
                    headers:_toMeta(data.meta.domain, data.meta.header),
                    data:_toList(data.meta.domain, data.data)
                };
            }
        };

    HTRAF.htsqlFormatter = HTRAF.htsqlVersion == 1 ? 'jsonex' : ':raw';

    var onerror = $script.attr('data-onerror');
    HTRAF.onerror = onerror ? new Function(onerror) :
        function (e, info) {
            alert('Error loading element\n\n'
                + info.reason + '\n'
                + info.detail + '\n\n'
                + 'Element:\n'
                + $.htraf.util.getHtml(info.element)
                + '\n');
        };

    var qs = location.search;
    HTRAF.param = {};
    if (qs) {
        qs = qs.substr(1, qs.length).split('&');
        for (var i = 0, l = qs.length; i < l; i++) {
            var param = qs[i].split('=');
            if (param.length == 2)
                HTRAF.param[param[0]] = decodeURIComponent(param[1]);
        }
    }

    HTRAF.$ = $;
// }}}


    $.htraf = $.htraf || {};
    $.htraf.plugin = $.htraf.plugin || {};

// {{{ Error handling
    $.htraf.AssertionError = function (message, element) {
        if (element)
            message += '\nElement: ' + getHtml(element);
        alert('[Assertion Error] ' + message);
    };

    function assert(condition, message, element) {
        // TODO: provide more information on element which triggered the error
        if (!condition)
            throw $.htraf.AssertionError(message, element);
    }

// }}}

// {{{ Common Utils

    var _id = 0;

    function generateId(prefix) {
        var prefix = prefix || 'htraf';
        return prefix + (_id++);
    }

    function str(value) {
        return value === null || value === undefined ? '' : value + '';
    }

    function getHtml(node) {
        var clone = $(node).clone().get(0);
        hiddenNode().children().remove();
        return hiddenNode().append(clone).html();
    }

    function isTrue(data) {
        if (!data)
            return false;
        if (typeof data == 'string') {
            data = data.toLowerCase();
            return data == 'yes' || data == 'true';
        }
        else
            return true;
    }

    function isHtsqlResource(url) {
        return url.match(/\.htsql$/) ? true : false;
    }

    var $hidden = null;

    function hiddenNode() {
        if (!$hidden)
            $hidden = $('<div style="display: none;"/>').appendTo('body');
        return $hidden;
    }

    function node(html) {
        var hidden = hiddenNode();
        hidden.get(0).innerHTML = html;
        return hidden.children().get(0);
    }

    ;

    function debug() {
        if (window.console)
            window.console.debug.apply(window.console, arguments);
    }

    function varsToQS(vars) {
        var ret = [];
        $.each(vars, function (key, value) {
            if (value === null)
                return;
            ret.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        });
        return ret.join('&');
    }

    function escape(obj, noQuotes) {
        var quote = noQuotes ? '' : "'";

        function _escape(obj) {
            if (obj === null || obj === undefined)
                return 'null()';
            else if (obj instanceof Array) {
                return '[' + obj.map(
                    function (item) {
                        return _escape(item);
                    }).join(',') + ']'
            }
            else if (obj instanceof Object) {
                var ret = [];
                for (var key in obj) {
                    if (HTRAF.htsqlVersion == '1' && (obj[key] === null
                        || obj[key] === undefined))
                        continue;
                    ret.push(_escape(key) + ':' + _escape(obj[key]));
                }
                return '{' + ret.join(',') + '}';
            }
            else {
                obj = $.trim(obj + '');
                return quote + obj.replace(/'/g, "''")
                    .replace(/%/g, "%25")
                    .replace(/\n/g, "%0A")
                    .replace(/\r/g, "%0D")
                    .replace(/\t/g, "%09")
                    + quote;
            }
        }

        return _escape(obj);
    }

    function expand(obj) {
        var vars = [];
        $.each(obj, function (key, value) {
            vars.push(key + '=' + JSON.stringify(value));
        });
        return vars.length ? 'var ' + vars.join(',') + ';' : '';
    }

    function expandConstants() {
        return expand($.htraf.util.constant);
    }

    var included = {};

    function require(files, onSuccess, onTimeout) {
        var started = new Date(), timeout = 60;
        onTimeout = onTimeout || function (files) {
            assert(false, "Inclusion timeout occured.\nFiles:\n\n"
                + files.join('\n'));
        };

        var head = document.getElementsByTagName("head")[0];

        function _createScriptTag(url, hasCheck) {
            var scriptNode = document.createElement('script');
            scriptNode.src = url;
            scriptNode.type = 'text/javascript';
            scriptNode.async = false;
            head.appendChild(scriptNode);
            included[url] = !hasCheck;
        }

        function _createCSSTag(url) {
            var cssNode = document.createElement('link');
            cssNode.type = 'text/css';
            cssNode.rel = 'stylesheet';
            cssNode.href = url;
            cssNode.media = 'screen';
            cssNode.title = 'dynamicLoadedSheet';
            head.appendChild(cssNode);
            included[url] = true;
        }

        var f = [], check = [];
        $.each(files, function (i, file) {
            if (file.css && included[file.css] === undefined)
                _createCSSTag(file.css);

            if (file.js)
                if (file.check) {
                    f.push(file.js);
                    check.push(file.check);
                }
                else {
                    if (!included[file.js])
                        _createScriptTag(file.js, false);
                }
        });


        function _require() {
            if (!f.length)
                return onSuccess.call();
            function next() {
                included[f[0]] = true;
                f.shift();
                check.shift();
                setTimeout(_require, 200);
            }

            if (included[f[0]] || check[0].call())
                return next();
            if (included[f[0]] === undefined)
                _createScriptTag(f[0], true);

            if ((new Date).getTime() - started < timeout * 1000)
                setTimeout(_require, 200);
            else
                onTimeout.call(null, f);
        }

        _require();
    }

    function loading(el) {
        var rect = el.getBoundingClientRect();
        var position = $('body').css('position');
        if (position != 'relative' && position != 'absolute')
            $('body').css('position', 'relative');
        return $('<img style="position: absolute;" src="' + HTRAF.prefix +
            '/htraf-load.gif">').appendTo('body').position({
                of:$(el),
                my:'center center',
                at:'center center'
            });
    }

    $.htraf.util = {
        constant:{
            HTSQL:'data-htsql',
            LOCAL:'data-bind',
            WIDGET:'data-widget',
            REF:'data-ref',
            SERVER:'data-server',
            HTSQL_PREFIX:'data-htsql-prefix',
            CHANGE:'change',
            USERSELECT:'userselect',
            BEFORELOAD:'beforeload',
            AFTERLOAD:'afterload',
            EMPTY:'empty',
            ERROR:'error',

            CSS_SELECTED:'htraf-selected',
            CSS_HOVER:'htraf-hover'
        },
        expandConstants:expandConstants,
        assert:assert,
        node:node,
        isTrue:isTrue,
        getHtml:getHtml,
        isHtsqlResource:isHtsqlResource,
        escape:escape,
        require:require
    };
    $.htraf.util.constant.SOURCES = [
        $.htraf.util.constant.HTSQL,
        $.htraf.util.constant.LOCAL
    ];
    eval(expandConstants());
// }}}

// {{{ Widgets

// {{{ Widget Utils
    function selectable(obj, property, attribute) {
        // TODO: consider using $.delegate() here

        obj._selectable = function () {
            var set = this[property], self = this;
            set.mouseover(function () {
                if (!$(this).hasClass(CSS_SELECTED))
                    $(this).addClass(CSS_HOVER);
            })
                .mouseout(function () {
                    $(this).removeClass(CSS_HOVER);
                });

            set.click(function () {
                $(this).removeClass(CSS_HOVER);
                self._select($(this).attr(attribute), this);
            });

            if (set.size() == 0) {
                this._trigger('empty');
                this._trigger('change');
            }
            else
            //set.eq(0).click();
                self._select(set.eq(0).attr(attribute));
        };
        obj._select = function (id, item) {
            this._index = id;

            var set = this[property];
            if (id === '' || id === null) {
                set.removeClass(CSS_SELECTED);
                return;
            }

            var selected = item ? $(item) : set.filter(function () {
                return $(this).attr(attribute) == id;
            });
            if (selected.size() == 0)
                return;

            set.removeClass(CSS_SELECTED);
            selected.eq(0).addClass(CSS_SELECTED);

            this._trigger('change');

        };

        obj.setValue = function (value) {
            var slot = this._getSlot(), index = null;
            $.each(this.data.data, function (i, row) {
                if (row[slot] == value && index == null)
                    index = i;
            });
            this._select(index);
        };

        obj.getValue = function () {
            var row = this._getRow();
            if (row == null)
                return null;
            return row[this._getSlot()];
        };

        obj._getRow = function () {
            if (this._index == null)
                return null;
            return this.data.data[this._index] || null;
        };

        obj.removeUserSelect = function () {
            if (this[property])
                this[property].unbind('click.userselect');
        };

        obj.addUserSelect = function () {
            var self = this;
            this[property].bind('click.userselect', function () {
                self._trigger(USERSELECT);
            });
        };
    }

    $.fn.htrafProc = function () {
        var args = $.makeArray(arguments);
        return this.each(function () {
            if (!$(this).data('htraf'))
                return;
            var method = $(this)[$(this).data('htraf')];
            if (!$.isFunction(method))
                return;
            method.apply($(this), args);
        });
    };

    $.fn.htrafFunc = function () {
        var args = $.makeArray(arguments);
        if (!this.size())
            return;

        return (function () {
            if (!$(this).data('htraf'))
                return;
            var method = $(this)[$(this).data('htraf')];
            if (!$.isFunction(method))
                return;
            return method.apply($(this), args);
        }).call(this[0]);
    };

    $.fn._attrOrig = $.fn.attr;
    $.fn.attr = function (attr, value) {
        if (value !== undefined) {
            var ret = $.fn._attrOrig.apply(this, arguments);
            if (attr.substr(0, 5) == 'data-')
                this.htrafProc('updateAttr', attr);
            return ret;
        }
        else
            return $.fn._attrOrig.apply(this, arguments);

    };

    $.fn._valOrig = $.fn.val;
    $.fn.val = function (value) {
        var origSelector = 'input,textarea,select';
        if (value !== undefined)
            return this.each(function () {
                if ($(this).is(origSelector) || !$(this).data('htraf'))
                    $.fn._valOrig.call($(this), value);
                else
                    $(this).htrafProc('setValue', value);
            });
        else
            return ($(this).is(origSelector) || !$(this).data('htraf')) ?
                $.fn._valOrig.call(this) : this.htrafFunc('getValue');

    };
// }}}

// {{{ Widgets: htraf.Base
    $.widget('htraf.Base', {
        _updateAttr:{},

        _setupSource:function () {
            var server = this.element.attr(SERVER);
            this._htsqlPrefix = (server ?
                $('script[' + SERVER + '="' + server + '"]').attr(HTSQL_PREFIX)
                : HTRAF.htsqlPrefix) || HTRAF.htsqlPrefix;

            if (this._ref)
                this._removeRef();
            else
                this._ref = $();
            this._param = {};

            var self = this;
            $.each(SOURCES, function (i, attr) {
                if (self._source)
                    return;
                var value = self.element.attr(attr);
                if (value) {
                    self._source = value;
                    self._sourceType = attr;
                }
            });

            switch (this._sourceType) {
                case HTSQL:
                    var refs = [],
                        ids = this.element.attr(REF) || '';
                    $.each(ids.split(' '), function (i, id) {
                        if (!id)
                            return;
                        if (id.substr(0, 1) == '_') {
                            var value = HTRAF.param[id.substr(1, id.length)];
                            self._param[id] = value || null;
                        }
                        else
                            refs.push('#' + id);
                    });
                    this._addRef(refs.join(','));
                    break;
                case LOCAL:
                    this._addRef('#' + this._source);
                    break;
            }
        },

        _getSlot:function () {
            var _slot = this.element.attr('data-slot') || '0',
                slot = 0;
            if (_slot.match(/^\d+$/)) {
                _slot = _slot - 0;
                if (_slot < this.data.headers.length)
                    slot = _slot;
            }
            else {
                $.each(this.data.headers, function (i, element) {
                    if (element.title == _slot)
                        slot = i;
                });
            }
            return slot;
        },

        _getRow:function () {
            return this.data.data[0] || null;
        },

        getData:function () {
            if (this.element.is('script'))
                return this.data;
            var row = this._getRow();
            return {
                headers:this.data.headers,
                data:row ? [row] : []
            };
        },

        _create:function () {
            var self = this;

            var plugin = $.htraf.plugin[this.widgetName] || {};

            function bindPlugin(prefix) {
                self.element.bind([BEFORELOAD, AFTERLOAD].join(' '), function (e) {
                    var fName = e.type.substr(0, 5) == 'after' ?
                        prefix + 'AfterLoad' : prefix + 'BeforeLoad';
                    var f = plugin[fName] || function () {
                    };
                    f.call(self);
                });
            }

            this.uniqueID = Math.ceil(100000 * Math.random())
                + '_' + (new Date).getTime();
            this.widgetEventPrefix = '';
            this.element.data('htraf', this.widgetName);
            this._setupSource();

            bindPlugin('pre');
            this.element.bind(
                [CHANGE, BEFORELOAD, AFTERLOAD, EMPTY, USERSELECT].join(' '),
                function (e) {
                    var code = $(this).attr('data-on' + e.type);
                    if (!code)
                        return;
                    return (new Function(code)).call(this);
                });
            bindPlugin('post');

            var onerrorCode = this.element.attr('data-on' + ERROR);
            var onerror = !onerrorCode ? null : function (e, info) {
                return (new Function(onerrorCode)).call(this, e, info);
            };
            this.element.bind(ERROR, onerror || HTRAF.onerror);

            if (HTRAF.addClass) {
                $.each(HTRAF.addClass.split(' '), function (i, cls) {
                    cls = $.trim(cls);
                    if (self.element.hasClass(cls))
                        return;
                    self.element.attr('class', cls + ' '
                        + self.element.attr('class') || '');
                });
            }
        },

        updateAttr:function (attr) {
            var f = this._updateAttr[attr] || null;
            if ($.isFunction(f))
                f.call(this);
        },

        ref:function () {
            return this._ref;
        },

        isLocal:function () {
            return this._sourceType == LOCAL;
        },

        _addRef:function (selector) {
            if ($(selector).size() == 0)
                return;

            var self = this;
            this._ref = this._ref.add(selector);
            this._ref
                .unbind('change.' + this.uniqueID)
                .bind('change.' + this.uniqueID, function () {
                    if (self.isLocal())
                        self.loadLocal();
                    else
                        self.load();
                });
        },

        _removeRef:function () {
            this._ref.unbind('change.' + this.uniqueID)
            this._ref = $();
        },

        getVars:function () {
            var vars = $.extend({}, this._param || {});
            this.ref().each(function () {
                if (!$(this).attr('id'))
                    return;
                var widget = $(this).data('htraf');
                vars[$(this).attr('id')] = $(this).val();
            });
            return vars;
        },

        _buildURL:function (formatter) {
            var url = this._source;
            formatter = formatter || '';
            this.assert(url, "Cannot load: URL is undefined");

            var vars = this.getVars(), h;
            if (isHtsqlResource(url))
                url = url + '?' + (formatter ? 'format=' + formatter + '&' : '')
                    + varsToQS(vars);
            else {
                if (url.substr(url.length - 1, 1) != '/' && formatter
                    && formatter.substr(0, 1) != '/') {
                    formatter = '/' + formatter;
                }
                if (HTRAF.htsqlVersion == '1' && formatter
                    && formatter.substr(formatter.length - 1, 1) != ')') {
                    formatter += '()';
                }

                if (HTRAF.htsqlVersion == '1') {
                    url = '/htsql:let(' + url + formatter + ','
                        + escape(vars) + ')';
                }
                else {
                    var s = [];
                    $.each(vars, function (key, value) {
                        var e = escape(value);
                        if (e.substr(0, 1) == '[') // sort of hack
                            e = '{' + e.substr(1, e.length - 2) + '}';
                        s.push('$' + key + ':=' + e);
                    });
                    s = s.join(',');
                    url = url + (s ? ' :where(' + s + ')' : '') + formatter;
                }
            }
            return this._htsqlPrefix + url;
        },

        removeUserSelect:function () {

        },

        addUserSelect:function () {

        },

        _loaded:function (data) {
            this.removeUserSelect();
            this.data = data;
            this.clear();
            this.render();
            this.setup();
            this.addUserSelect();
        },

        loadLocal:function () {
            var $source = $('#' + this._source);

            var error = "Misconfigured '" + LOCAL + "' attribute.";
            this.assert($source.size() > 0, "Source is not found. " + error);
            this.assert($source.size() == 1, "Multiple sources. " + error);
            this.assert($source.data('htraf'), "Source is not HTRAF widget");
            var data = $source.htrafFunc('getData');
            this._loaded(data);
        },

        load:function () {
            var dataType = this._sourceType.substr('data-'.length, 100),
                convert = HTRAF.convert[dataType] || function (data) {
                    return data;
                },
                self = this;

            this._trigger(BEFORELOAD);
            var url = this._buildURL(HTRAF.htsqlFormatter),
                $spinner = loading(this.element[0]);
            $.ajax({
                url:url,
                dataType:'json',
                success:function (data) {
                    $spinner.remove();
                    self._loaded(convert(data));
                    self._trigger(AFTERLOAD);
                },
                error:function (request, status) {
                    $spinner.remove();
                    try {
                        var obj = eval('(' + request.responseText + ')');
                    }
                    catch (e) {
                        var obj = {
                            reason:request.responseText,
                            detail:''
                        };
                    }
                    obj.element = self.element[0];
                    self._trigger(ERROR, {}, [obj]);
                }
            });
        },

        clear:function () {
            $(this.element).children().remove();
        },

        render:function () {
        },

        setup:function () {
        },

        getValue:function () {
            var row = this._getRow();
            return row ? row[this._getSlot()] : null;
        },

        setValue:function (value) {
            this.assert(false, 'setting value is not possible');
        },

        assert:function (condition, message) {
            assert(condition, message, this.element.get(0));
        }
    });

    $.htraf.Base.prototype._updateAttr[HTSQL] =
        $.htraf.Base.prototype._updateAttr[LOCAL] =
            function () {
                this._setupSource();
                this.load();
            };
// }}}

// {{{ Widgets: htraf.select
    $.widget("htraf.select", $.htraf.Base, {
        _create:function () {
            $.htraf.Base.prototype._create.call(this);
            this.keepOptions = this.element[0].options.length;
        },

        clear:function () {
            if (this.keepOptions)
                this.element[0].selectedIndex = 0;
            this.element[0].options.length = this.keepOptions || 0;
        },

        render:function () {
            var select = this.element[0],
                data = this.data.data,
                keep = this.keepOptions;
            for (var i = data.length - 1; i >= 0; i--) {
                var row = data[i];
                select.options[i + keep] = new Option(
                    row[1] === undefined ? row[0] : row[1],
                    row[0] === null ? '' : row[0],
                    i + keep == 0, i + keep == 0);
            }
            for (var i = keep - 1; i >= 0; i--) {
                var option = select.options[i],
                    value = option.value == '' ? null : option.value;
                this.data.data.unshift([value, option.text]);
            }
            if (!data.length)
                this._trigger('empty');
            this._trigger('change');
        },

        _getRow:function () {
            return this.data.data[this.element[0].selectedIndex] || null;
        },

        setValue:function (value) {
            value = value === null ? '' : value + '';
            this.element._valOrig(value);
        },

        removeUserSelect:function () {
            this.element.unbind('change.userselect');
        },

        addUserSelect:function () {
            var self = this;
            this.element.bind('change.userselect', function () {
                self._trigger(USERSELECT);
            });
        }
    });
// }}}

// {{{ Widgets: htraf.checkList
    $.widget("htraf.checkList", $.htraf.Base, {
        _create:function () {
            $.htraf.Base.prototype._create.call(this);

            var self = this;
            this.element.delegate('click', 'input', function () {

            });
        },

        render:function () {
            var data = this.data.data;
            var id = this.element.attr('id');
            var html = [];
            for (var i = data.length - 1; i >= 0; i--) {
                var row = data[i];
                var label = row[1] === undefined ? row[0] : row[1];
                var value = row[0] === null ? row[0] : '';
                html.push('<input type="checkbox" name="'
                    + id + '" value="' + value + '"></input>&nbsp;<span>'
                    + label + '</span>');
            }

            this.element.html(html.join('<br/>'));

            if (!data.length)
                this._trigger('empty');
            this._trigger('change');
        },

        _getRow:function () {
            // We want the value of the checklist to be an array of the values of any checked checkboxes
            // Not sure how to make this happen
            var ckvalue = [];
            $(this).find('input:checked').each(function () {
                ckvalue.push($(this).val());
            });
            return "'" + ckvalue + "'";
        },

        setValue:function (value) {
            value = value === null ? '' : value + '';
            this.element._valOrig(value);
        },

        removeUserSelect:function () {
            this.element.unbind('change.userselect');
        },

        addUserSelect:function () {
            var self = this;
            this.element.bind('change.userselect', function () {
                self._trigger(USERSELECT);
            });
        }
    });
// }}}

// {{{ Widgets: htraf.segmentedlist
// produces indented list of segmented data
    $.widget("htraf.segmentedlist", $.htraf.Base, {
        _create:function () {
            $.htraf.Base.prototype._create.call(this);
        },

        render:function () {
            var data = this.data.data;
            var id = this.element.attr('id');
            // data not is right format and doesn't include multiple segments
            // so use our own get data function
            // we must fix htraf to support multiple segments
            this.getJSONdata(id);

            if (!data.length)
                this._trigger('empty');
            this._trigger('change');
        },

        // Put the results of a segmented query into a html object, usually a div
        getJSONdata:function (id) {
            var htsql = this._source + '/json()';
            var outerthis = this;
            $.getJSON(htsql)
                .success(function (data) {
                    $("#" + id).append(outerthis.arrayToStr(data));
                })
                .error(function () {
                    alert("Error retrieving HTSQL Statement information")
                });
        },

        // Test if object is an array
        isArray:function (what) {
            return Object.prototype.toString.call(what) === '[object Array]';
        },

        // Make every element of an array into an html line
        arrayToStr:function (arr, indent) {
            var tab = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';  // used for indenting and spacing columns

            if (indent == undefined)
                indent = 0;
            else
                indent = indent + 1;

            // here is where we wrap each line
            // just using span for now, but we can make it a table row or whatever
            var str = '<span class="htraf_seg_' + indent + '">';

            // for each element in the array
            for (var i in arr) {
                for (var j = 0; j < indent; j++)
                    str = str + tab;

                // for each column n the row
                // skip the special htsql: columns and passover lower segments
                for (var key in arr[i]) {
                    if (arr[i].hasOwnProperty(key)) {
                        if (key == "htsql:id" | key == "htsql:idtag" | key == "htsql:tag")
                            continue;
                        if (this.isArray(arr[i][key]))
                            continue;
                        else
                        // here is where we format each column
                        // just using string for now
                            str = str + key + " :" + arr[i][key] + tab;
                    }
                }
                str = str + "</span><br/>";

                // now, for each sub record
                for (var key in arr[i]) {
                    if (arr[i].hasOwnProperty(key)) {
                        if (this.isArray(arr[i][key]))
                        // make recursive call to arrayToStr
                            str = str + this.arrayToStr(arr[i][key], indent);
                    }
                }
            }
            return str;
        },

        removeUserSelect:function () {
            this.element.unbind('change.userselect');
        },

        addUserSelect:function () {
            var self = this;
            this.element.bind('change.userselect', function () {
                self._trigger(USERSELECT);
            });
        }
    });
// }}}

// {{{ Widgets: htraf.table
    $.widget("htraf.table", $.htraf.Base, {
        _create:function () {
            $.htraf.Base.prototype._create.call(this);
            selectable(this, '_tr', 'data-index');
        },

        render:function () {
            var data = this.data,
                $element = this.element,
                $thead = $('<thead/>').appendTo($element),
                $tbody = $('<tbody/>').appendTo($element),
                $tfoot = $('<tfoot/>').appendTo($element),
                hidden = {};

            for (var i = 0; i < data.headers.length; i++)
                if (isTrue($element.attr('data-hide-column-' + i)))
                    hidden[i] = true;

            $.each(data.headers, function (i, el) {
                var $thHead = $('<th/>').text(el.title).addClass('c' + i)
                    .appendTo($thead),
                    $thFoot = $('<th/>').addClass('c' + i).appendTo($tfoot);

                if (hidden[i]) {
                    $thHead.css('display', 'none');
                    $thFoot.css('display', 'none');
                }
            });

            $.each(data.data, function (i, row) {
                var $tr = $('<tr/>').appendTo($tbody)
                    .addClass('r' + i)
                    .addClass(i % 2 ? 'even' : 'odd')
                    .attr('data-index', i + '');
                $.each(row, function (j, value) {
                    var $td = $('<td/>').addClass('c' + j)
                        .text(str(value)).appendTo($tr);
                    if (hidden[j])
                        $td.css('display', 'none');
                });
            });
        },

        setup:function () {
            this._tr = this.element.find('tr');
            var selectable = this.element.attr('data-selectable') || 'yes';
            if (isTrue(selectable))
                this._selectable();
        }
    });
    $.htraf.table.prototype._updateAttr['data-column'] = function () {
        this._setupId();
        this._trigger('change');
    };

// }}}

// {{{ Widgets: htraf.singleValue
    $.widget("htraf.singleValue", $.htraf.Base, {
        render:function () {
            var value = this.getValue();
            value = value === null || value === undefined ? '' : value + '';
            this.element.text(value);
            this._trigger('change');
        }
    });
// }}}

// {{{ Widgets: htraf.iframe
    $.widget("htraf.iframe", $.htraf.Base, {
        _create:function () {
            assert(this.element.is('iframe'), '"iframe" widget is incompatible',
                this.element.get(0));
            $.htraf.Base.prototype._create.call(this);
        },

        clear:function () {
        },

        load:function () {
            var self = this;
            this._trigger(BEFORELOAD);
            this.element.attr('src', 'about:blank');
            this.element.one('load', function () {
                self._trigger(AFTERLOAD);
            });
            this.element.attr('src', this._buildURL());
        }
    });
// }}}

// {{{ Widgets: htraf.ul, htraf.ol
    var list = {
        _create:function () {
            $.htraf.Base.prototype._create.call(this);
            selectable(this, '_li', 'data-index');
        },

        render:function () {
            var $element = this.element;
            $.each(this.data.data, function (i, row) {
                $('<li/>').text(str(row[1] === undefined ? row[0] : row[1]))
                    .attr('data-index', i)
                    .appendTo($element);
            });
        },

        setup:function () {
            this._li = this.element.find('li');
            this._selectable();
        }
    };
    $.widget('htraf.ul', $.htraf.Base, list);
    $.widget('htraf.ol', $.htraf.Base, list);
// }}}

// {{{ Widgets: htraf.chart
    $.widget('htraf.chart', $.htraf.Base, {
        supportedType:['bar', 'pie', 'line', 'stack'],
        supportedLegend:['ne', 'se', 'nw', 'sw', 'no'],

        _create:function () {
            $.htraf.Base.prototype._create.call(this);
            assert(this.element.is('div'), "Only <div> is supported as a chart"
                + " conatiner", this.element.get(0));
            this._getConfigAttrs();
            this.element.bind(EMPTY, function () {
                $(this).html('<strong>No Data</strong>');
            });
        },

        _getConfigAttrs:function () {
            var attrs = {
                type:this.element.attr('data-type') || 'bar',
                showTitle:isTrue(this.element.attr('data-show-title') || 'yes'),
                title:this.element.attr('data-title')
                    || this.element.attr(HTSQL),
                legend:this.element.attr('data-legend') || 'ne',
                xVertical:isTrue(this.element.attr('data-x-vertical')),
                yInt:isTrue(this.element.attr('data-yint'))
            };
            this.assert($.inArray(attrs.type, this.supportedType) != -1,
                "Unsupported chart type. \n\nPossible values: \n"
                    + this.supportedLegend.join(','));
            this.assert($.inArray(attrs.legend, this.supportedLegend) != -1,
                "Unsupported legend option. \n\nPossible values: \n"
                    + this.supportedLegend.join(','));
            return attrs;
        },

        _getRendererFiles:function () {
            var attrs = this._getConfigAttrs();
            switch (attrs.type) {
                case 'stack':
                case 'bar':
                    return [].concat([
                        {
                            js:HTRAF.prefix + '/lib/jqplot.barRenderer.min.js',
                            check:function () {
                                return $.jqplot && $.jqplot.BarRenderer;
                            }
                        },
                        {
                            js:HTRAF.prefix + '/lib/jqplot.pointLabels.min.js',
                            check:function () {
                                return $.jqplot && $.jqplot.PointLabels;
                            }
                        },
                        {
                            js:HTRAF.prefix + '/lib/jqplot.LogAxisRenderer.min.js',
                            check:function () {
                                return $.jqplot && $.jqplot.LogAxisRenderer;
                            }
                        },
                        {
                            js:HTRAF.prefix
                                + '/lib/jqplot.categoryAxisRenderer.min.js',
                            check:function () {
                                return $.jqplot && $.jqplot.CategoryAxisRenderer;
                            }
                        }
                    ],
                        !attrs.xVertical ? [] : [
                            {
                                js:HTRAF.prefix + '/lib/jqplot.canvasTextRenderer.min.js',
                                check:function () {
                                    return $.jqplot && $.jqplot.CanvasFontRenderer
                                        && $.jqplot.CanvasTextRenderer;
                                }
                            },
                            {
                                js:HTRAF.prefix
                                    + '/lib/jqplot.canvasAxisTickRenderer.min.js',
                                check:function () {
                                    return $.jqplot && $.jqplot.CanvasAxisTickRenderer
                                        && $.jqplot.CanvasFontRenderer;
                                }
                            }
                        ]);
                case 'line':
                    return [
                        {
                            js:HTRAF.prefix + '/lib/jqplot.dateAxisRenderer.min.js',
                            check:function () {
                                return $.jqplot && $.jqplot.DateAxisRenderer;
                            }
                        }
                    ];
                case 'pie':
                    return [
                        {
                            js:HTRAF.prefix + '/lib/jqplot.pieRenderer.min.js',
                            check:function () {
                                return $.jqplot && $.jqplot.PieRenderer;
                            }
                        }
                    ];
                default:
                    return [];
            }
        },

        load:function () {
            var self = this, load = $.htraf.Base.prototype.load;
            var files = [
                {
                    js:HTRAF.prefix + '/lib/jquery.jqplot.min.js',
                    css:HTRAF.prefix + '/lib/jquery.jqplot.min.css',
                    check:function () {
                        return $.jqplot;
                    }
                }
            ];
            if ($.browser.msie)
                files.unshift({
                    js:HTRAF.prefix + '/lib/excanvas.min.js',
                    check:function () {
                        return window.CanvasPattern;
                    }
                });
            files = [].concat(files, this._getRendererFiles());
            require(files, function () {
                load.call(self);
            });
        },

        _getChartConfig:function (data) {
            var data = this.data;
            var attrs = this._getConfigAttrs();

            function labels() {
                var l = [];
                $.each(data.headers, function (i, el) {
                    if (i == 0)
                        return;
                    l.push({label:el.title});
                });
                return l;
            }

            ;
            var config = {
                title:attrs.showTitle ? attrs.title : null,
                legend:{
                    show:attrs.legend != 'no',
                    location:attrs.legend
                }
            };
            switch (attrs.type) {
                case 'pie':
                    return $.extend(config, {
                        grid:{
                            drawBorder:false,
                            drawGridlines:false,
                            background:'#FFFFFF',
                            shadow:false
                        },

                        axesDefaults:{

                        },
                        seriesColors:['#8DD3C7', '#FFFFB3', '#BEBADA', '#FB8072', '#80B1D3', '#FDB462','#B3DE69','#FCCDE5','#D9D9D9','#BC80BD'],
                        seriesDefaults:{
                            renderer:$.jqplot.PieRenderer,
                            rendererOptions:{
                                varyBarColor: true,
                                showDataLabels:true,
                                sliceMargin:2,
                                fill:true,
                                lineWidth:5,
                                dataLabels:'percent'
                            }
                        },
                        legend:{
                            fontSize:12,
                            show:true,
                            rendererOptions:{
                                numberRows:0
                            },
                            location:'e'
                        }
                    });

                case 'bar':
                case 'stack':
                {
                    var ticks = [];
                    var yaxis = (attrs.yInt) ? {
                        min:0,
                        tickOptions:{formatString:'%d'}
                    } : {min:0};
                    $.each(data.data, function (i, row) {
                        ticks.push(row[0]);
                    });
                    return $.extend(config, {
                        // animate: true,
                        seriesDefaults:{
                            pointLabels:{show: true},
                            renderer:$.jqplot.BarRenderer,
                            rendererOptions:{
                            barMargin:5,
                            }
                        },
                         series: labels(),
                         stackSeries: attrs.type == 'stack',
                        grid:{
                            drawBorder:false,
                            drawGridlines:true,
                            background:'#FFFFF9',
                            shadow:false
                        },
                        axes:{
                            // Use a category axis on the x axis and use our custom ticks
                            xaxis:{
                                renderer:$.jqplot.CategoryAxisRenderer,
                                ticks:ticks,
                                tickRenderer:!attrs.xVertical ? undefined :
                                    $.jqplot.CanvasAxisTickRenderer,
                                tickOptions:{
                                    angle:attrs.xVertical ? -90 : 0
                                }
                            },
                            yaxis:yaxis
                        }
                    });
                }

                case 'line':
                {
                    var type = data.headers[0].domain;
                    var xaxis = (type == 'number') ? {
                        tickOptions:{formatString:'%d'}
                    } : {
                        renderer:$.jqplot.DateAxisRenderer,
                        tickOptions:{
                            formatString:'%Y-%m-%d'
                        }
                    };
                    var yaxis = (attrs.yInt) ?
                    {tickOptions:{formatString:'%d'}} : {};
                    return $.extend(config, {
                        series:labels(),
                        axes:{
                            xaxis:xaxis,
                            yaxis:yaxis
                        }
                    });
                }
            }
        },

        _getChartData:function (data) {
            var data = this.data;
            var attrs = this._getConfigAttrs(), ret = [];
            switch (attrs.type) {
                case 'pie':
                {
                    var line = [];
                    $.each(data.data, function (i, row) {
                        line.push(row.slice(0, 2));
                        line[line.length - 1][1] = line[line.length - 1][1] - 0;
                    });
                    ret.push(line);
                    break;
                }

                case 'bar':
                case 'stack':
                {
                    $.each(data.data, function (i, row) {
                        row = row.slice(1, row.length);
                        $.each(row, function (i, item) {
                            ret[i] = ret[i] || [];
                            ret[i].push(item - 0);
                        });
                    });
                    break;
                }

                case 'line':
                {
                    var type = data.headers[0].domain;
                    this.assert(type == 'number' || type == 'date',
                        "First column must be numeric or date");
                    var convert = type == 'number' ? function (x) {
                        return x - 0;
                    } :
                        function (x) {
                            return x;
                        };
                    $.each(data.data, function (i, row) {
                        var tick = convert(row[0]);
                        row = row.slice(1, row.length);
                        $.each(row, function (i, item) {
                            ret[i] = ret[i] || [];
                            ret[i].push([tick, item - 0]);
                        });
                    });
                    break;
                }
            }
            return ret;
        },

        render:function () {
            if (!this.element.attr('id'))
                this.element.attr('id', generateId('chart'));
            if (this.data.data.length == 0) {
                this._trigger(EMPTY);
                return;
            }
            $.jqplot(this.element.attr('id'),
                this._getChartData(),
                this._getChartConfig());
        },

        clear:function () {
            var clear = $.htraf.Base.prototype.clear;
            if (!$.browser.msie)
                clear.call(this);
            else {
                var el = this.element[0];
                while (el.childNodes.length)
                    el.removeChild(el.childNodes[0]);
            }
        }
    });

    $.htraf.chart.prototype._updateAttr['data-type'] =
        $.htraf.chart.prototype._updateAttr['data-title'] =
            $.htraf.chart.prototype._updateAttr['data-show-title'] =
                $.htraf.chart.prototype._updateAttr['data-legend'] =
                    $.htraf.chart.prototype._updateAttr['data-yint'] =
                        $.htraf.chart.prototype._updateAttr['data-x-vertical'] = function () {
                            this.clear();
                            $.jqplot(this.element.attr('id'),
                                this._getChartData(),
                                this._getChartConfig());
                        };
// }}}

// }}}

// {{{ Initialization
    $.fn.widgetize = function () {
        return this.each(function () {
            var widget = $(this).attr(WIDGET) || this.tagName.toLowerCase();
            if (widget == 'util' || widget == 'plugin')
                return;
            if (!$.htraf[widget])
                widget = 'singleValue';
            if (!$(this).data('htraf'))
                $(this)[widget]();
        });
    };

    $.fn.loadWidget = function () {
        return this.each(function () {
            var widget = $(this).data('htraf');
            if (!widget)
                return;
            if (!$(this)[widget]('isLocal'))
                $(this)[widget]('load');
        });
    };

    $.fn.ref = function () {
        if (this.size() == 0)
            return $();
        var el = this[0];
        var widget = $(el).data('htraf');
        if (!widget)
            return $();
        return $(el)[widget]('ref');
    };

    $.fn.detectCycles = function () {
        function expand(node, proceed) {
            $(node).ref().each(function () {
                assert($.inArray(this, proceed) == -1, "Cycle detected", this);
                expand(this, [].concat(proceed, [this]));
            });
        }

        return this.each(function () {
            expand(this, [this]);
        });
    };

    $(function () {
        setTimeout(function () {
            var selector = '[' + SOURCES.join('],[') + ']';
            $(selector)
                .filter(function () {
                    var ret = false, self = this;
                    $.each(SOURCES, function (i, attr) {
                        ret = ret || !!$(self).attr(attr);
                    });
                    return ret;
                })
                .widgetize()
                .detectCycles()
                .filter(function () {
                    return $(this).ref().filter(
                        function () {
                            return $(this).data('htraf') ? true : false;
                        }).size() == 0;
                })
                .loadWidget();
        });
    });
// }}}

})(jQuery);

// vim: foldmethod=marker:
