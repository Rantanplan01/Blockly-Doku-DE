function Scripts(main) {
    var that            = this;
    this.list           = [];
    this.groups         = [];
    this.hosts          = [];
    this.$grid          = $('#grid-scripts');
    this.$dialogCron    = $('#dialog-cron');
    this.$dialogScript  = $('#dialog-script');
    this.$dialogExport  = $('#dialog-export-blockly');
    this.editor         = null;
    this.editorDialog   = null;
    this.changed        = false;
    this.main           = main;
    this.currentId      = null;
    this.engines        = [];
    this.currentEngine  = '';
    this.languageLoaded = false;
    this.blocklyWorkspace = null;
    
    function addScript(group) {
        group = group || 'script.js.common';
        // Find new unique name
        var newText = _('Script');
        var idx     = 1;
        var name    = newText + idx;

        while (that.main.objects[group + '.' + name]) {
            if (idx === '') idx = 0;
            idx++;
            name = newText + idx;
        }
        var instance = '';
        var engineType = '';

        // find first instance
        for (var i = 0; i < that.main.instances.length; i++) {
            if (that.main.objects[that.main.instances[i]] && that.main.objects[that.main.instances[i]] && that.main.objects[that.main.instances[i]].common.engineTypes) {
                instance = that.main.instances[i];
                if (typeof that.main.objects[main.instances[i]].common.engineTypes === 'string') {
                    engineType = that.main.objects[that.main.instances[i]].common.engineTypes;
                } else {
                    engineType = that.main.objects[that.main.instances[i]].common.engineTypes[0];
                }
                break;
            }
        }

        var id = group + '.' + name.replace(/[\s"']/g, '_');
        that.main.socket.emit('setObject', id, {
            common: {
                name:       name,
                engineType: engineType,
                source:     '',
                enabled:    false,
                engine:     instance
            },
            type: 'script'
        }, function (err) {
            if (err) {
                that.main.showError(err);
                that.init(true);
            } else {
                setTimeout(function () {
                    that.$grid.selectId('show', id);
                    editScript(id);
                }, 500);
            }
        });
    }

    function addScriptInGroup(_group) {
        fillGroups('edit-new-group-group');

        if (that.main.objects[_group] && that.main.objects[_group].type === 'script') {
            _group = getGroup(_group);
        }
        $('#edit-new-group-group').val(_group || 'script.js');

        if (!that.$newGroupDialog) {
            that.$newGroupDialog = $('#dialog-new-group').dialog({
                autoOpen:   false,
                modal:      true,
                width:      400,
                height:     220,
                resizable:  false,
                title:      _('Create new group'),
                buttons: [
                    {
                        id: 'script-group-button-save',
                        text: _('Ok'),
                        click: function () {
                            var group = $('#edit-new-group-group').val() || 'script.js';
                            var name  = $('#edit-new-group-name').val();
                            if (!name) {
                                that.main.showError(_('No group name'));
                                that.$newGroupDialog.dialog('close');
                                return;
                            }
                            group += '.' + name.replace(/["'\s.]+/g, '_');

                            $('#script-group-button-save').button('disable');
                            $('#script-group-button-cancel').button('disable');

                            // check if object with such name exists
                            if (that.main.objects[group]) {
                                that.main.showMessage(_('Object %s yet exists', group));
                                that.$newGroupDialog.dialog('close');
                            } else {
                                that.main.socket.emit('setObject', group, {
                                    common: {
                                        name: name
                                    },
                                    type: 'channel'
                                }, function (err) {
                                    that.$newGroupDialog.dialog('close');
                                    if (err) {
                                        that.main.showError(err);
                                        that.init(true);
                                    } else {
                                        setTimeout(function () {
                                            that.$grid.selectId('show', group);
                                            editScript(group);
                                        }, 500);
                                    }
                                });
                            }
                        }
                    },
                    {
                        id: 'script-group-button-cancel',
                        text: _('Cancel'),
                        click: function () {
                            that.$newGroupDialog.dialog('close');
                        }
                    }
                ],
                open: function () {
                    $(event.target).parent().find('.ui-dialog-titlebar-close .ui-button-text').html('');
                    $('#script-group-button-save').button('disable');
                    $('#script-group-button-cancel').button('enable');
                    $('#edit-new-group-name').val('');
                }
            });

            $('#edit-new-group-name').change(function () {
                if ($(this).val()) {
                    $('#script-group-button-save').button('enable');
                } else {
                    $('#script-group-button-save').button('disable');
                }
            }).keyup(function (e) {
                $(this).trigger('change');
                if (e.keyCode === 13) $('#script-group-button-save').trigger('click');
            });
        }

        that.$newGroupDialog.dialog('open');
    }

    this.prepare = function () {
        this.$dialogCron.dialog({
            autoOpen:   false,
            modal:      true,
            width:      700,
            height:     550,
            resizable:  false,
            title:      _('Cron expression'),
            buttons: [
                {
                    id:     'dialog_cron_insert',
                    text:   _('Insert'),
                    click:  function () {
                        var val = $('#div-cron').cron('value');
                        that.$dialogCron.dialog('close');

                        if (!$('#dialog-script').is(':visible')) {
                            that.editor.insert('"' + val + '"');
                            that.editor.focus();
                        } else {
                            that.editorDialog.insert('"' + val + '"');
                            that.editorDialog.focus();
                        }
                    }
                },
                {
                    id:     'dialog_cron_clear',
                    text: _('Clear'),
                    click: function () {
                        $('#div-cron').cron('value', '* * * * *');
                    }
                },
                {
                    id:     'dialog_cron_callback',
                    text:   _('Set CRON'),
                    click:  function () {
                    }
                },
                {
                    text: _('Cancel'),
                    click: function () {
                        that.$dialogCron.dialog('close');
                    }
                }
            ]
        });

        this.$dialogScript.dialog({
            autoOpen:   false,
            modal:      true,
            width:      700,
            height:     550,
            resizable:  true,
            title:      _('Edit script'),
            resize:     function () {
                that.main.saveConfig('script-edit-width',  $(this).parent().width());
                that.main.saveConfig('script-edit-height', $(this).parent().height() + 10);
                that.editorDialog.resize();
            },
            beforeClose:      function () {
                if (that.editorDialog._changed) {
                    if (window.confirm(_('Script changes are not saved. Discard?'))) {
                        that.editorDialog._changed = false;
                        return null;
                    } else {
                        return false;
                    }
                }
            },
            buttons: [
                {
                    id:     'dialog_script_save',
                    text:   _('Save'),
                    click:  function () {
                        that.editorDialog._changed = false;
                        that.$dialogScript.dialog('close');

                        var val = that.editorDialog.getValue();
                        var cb = that.$dialogScript.data('callback');
                        that.$dialogScript.data('callback', null);

                        if (typeof cb === 'function') cb(val);
                        if (that.editorDialog._isReturn && val.indexOf('return ') === -1) {
                            that.main.showMessage(_('No return found'), _('Error'), 'alert');
                        }
                    }
                },
                {
                    text: _('Cancel'),
                    click: function () {
                        that.$dialogScript.dialog('close');
                    }
                }
            ]
        });
        
        $('#div-cron').cron({
            value: '* * * * *'
        });

        $('#script-edit-button-save').button({
            icons: {
                primary: 'ui-icon-disk'
            },
            label: _('Save')
        }).click(function () {
            that.saveScript();
        });

        $('#script-edit-button-cancel').button({
            icons: {
                primary: 'ui-icon-cancel'
            },
            label: _('Cancel')
        }).click(function () {
            editScript(that.currentId);
        });

        $('#script-output-clear').button({
            icons: {
                primary: 'ui-icon-trash'
            },
            text: false
        }).css({width: 20, height: 20}).click(function () {
            $('#script-output').html('');
        }).attr('title', _('Clear output'));

        $('#script-output-down').button({
            icons: {
                primary: 'ui-icon-arrowthickstop-1-s'
            },
            text: false
        }).css({width: 20, height: 20}).click(function () {
            if (that.$parentOutput) that.$parentOutput.scrollTop($('#script-output').height());
        }).attr('title', _('Scroll down'));

        $('#edit-wrap-lines').change(function () {
            that.main.saveConfig('script-editor-wrap-lines', $(this).prop('checked'));
            if (that.editor) that.editor.getSession().setUseWrapMode($(this).prop('checked'));
        });

        $('#dialog-edit-wrap-lines').change(function () {
            that.main.saveConfig('script-editor-dialog-wrap-lines', $(this).prop('checked'));
            if (that.editorDialog) that.editorDialog.getSession().setUseWrapMode($(this).prop('checked'));
        });
        
        fillGroups('edit-script-group');

        $('.import-drop-file').change(function (e) {
            fileHandler(e);
        });
        $('.import-text-drop').click(function (e) {
            $('.import-drop-file').trigger('click');
        });
        $('#start_import_scripts').button().click(function () {
            $('#dialog_import_scripts').dialog('close');
            main.confirmMessage(_('Existing scripts will be overwritten. Are you sure?'), null, null, 700, function (result) {
                if (result) {
                    var host = getLiveHost();

                    if (!host) {
                        window.alert('No active host found');
                        return;
                    }
                    main.socket.emit('sendToHost', host, 'writeObjectsAsZip', {
                        data:    $('.import-file-name').data('file'),
                        adapter: 'javascript',
                        id:      'script.js'
                    }, function (data) {
                        if (!data || data.error) {
                            main.showError(data ? data.error : 'Unknown error');
                        } else {
                            main.showMessage(_('Ok'));
                            that.init(true);
                        }
                    });
                }
            });
        });

        window.addEventListener('resize', this.resize, false);

        // load blockly language
        var fileLang = document.createElement('script');
        fileLang.setAttribute('type', 'text/javascript');
        fileLang.setAttribute('src', 'google-blockly/msg/js/' + (systemLang || 'en') + '.js');
        // most browsers
        fileLang.onload = function () {
            that.languageLoaded = true;
        };
        // IE 6 & 7
        fileLang.onreadystatechange = function() {
            if (this.readyState === 'complete') {
                that.languageLoaded = true;
            }
        };
        document.getElementsByTagName('head')[0].appendChild(fileLang);

        var fileCustom = document.createElement('script');
        fileCustom.setAttribute('type', 'text/javascript');
        fileCustom.setAttribute('src', 'google-blockly/own/msg/' + (systemLang || 'en') + '.js');
        // most browsers
        fileCustom.onload = function () {
            that.languageLoaded = true;
        };
        // IE 6 & 7
        fileCustom.onreadystatechange = function() {
            if (this.readyState === 'complete') {
                that.languageLoaded = true;
            }
        };
        document.getElementsByTagName('head')[0].appendChild(fileCustom);
    };

    this.resize = function (width, height) {
        var wasVisible = $('#blockly-editor').data('wasVisible');
        if (wasVisible !== true && wasVisible !== false) {
            wasVisible = $('#blockly-editor').is(':visible');
        }
        // Set the height of svg
        if (wasVisible === true) {
            $('#blockly-editor').hide();
            $('.blocklyWidgetDiv').hide();
            $('.blocklyTooltipDiv').hide();
            $('.blocklyToolboxDiv').hide();
            $('#blockly-editor svg').height($('#height-editor').height());
            $('#blockly-editor').show();
            $('.blocklyWidgetDiv').show();
            $('.blocklyTooltipDiv').show();
            $('.blocklyToolboxDiv').show();
        } else {
            $('#blockly-editor svg').height($('#height-editor').height());
        }

        $('#blockly-editor').data('wasVisible', null);

        if (that.blocklyWorkspace) Blockly.svgResize(that.blocklyWorkspace);

        if (that.editor) that.editor.resize();
    };

    function blockly2JS(oneWay) {
        $('#edit-script-engine-type').find('option[value="Blockly"]').remove();
        blocklyCode2JSCode(oneWay);

        that.editor.setReadOnly(false);

        that.changed = true;
        $('#script-edit-button-save').button('enable');
        $('#script-edit-button-cancel').button('enable');

        switchViews(false, that.currentEngine);

        if (that.currentEngine.match(/^[jJ]ava[sS]cript/)) {
            that.editor.getSession().setMode('ace/mode/javascript');
        } else if (that.currentEngine.match(/^[cC]offee[sS]cript/)) {
            that.editor.getSession().setMode('ace/mode/coffee');
        }
    }

    function blocklyCode2JSCode(oneWay, justConvert) {
        var code = Blockly.JavaScript.workspaceToCode(that.blocklyWorkspace);
        if (!oneWay) {
            code += '\n';
            var dom = Blockly.Xml.workspaceToDom(that.blocklyWorkspace);
            var text = Blockly.Xml.domToText(dom);
            code += '//' + btoa(encodeURIComponent(text));
        }

        if (!justConvert) that.editor.setValue(code, -1);
        return code;
    }

    function jsCode2Blockly(text) {
        text = text || '';
        var lines = text.split(/[\r\n|\r|\n]+/g);
        var xml = '';
        for (var l = lines.length - 1; l >= 0; l--) {
            if (lines[l].substring(0, 2) === '//') {
                xml = lines[l].substring(2);
                break;
            }
        }
        if (xml.substring(0, 4) === '<xml') {
            return xml;
        } else {
            var code;
            try {
                code = decodeURIComponent(atob(xml));
            } catch (e) {
                code = null;
                console.error('cannot decode: ' + xml);
                console.error(e);
            }
            return code;
        }
    }

    function removeBlocklyFromCode(text) {
        text = text || '';
        var lines = text.split(/[\r\n|\r|\n]+/g);
        var xml = '';
        for (var l = lines.length - 1; l >= 0; l--) {
            if (lines[l].substring(0, 2) === '//') {
                xml = lines[l].substring(2);
                if (xml.substring(0, 4) === '<xml') {
                    lines.splice(l, 1);
                    break;
                } else {
                    try {
                        if (decodeURIComponent(atob(xml)).substring(0, 4) === '<xml') {
                            lines.splice(l, 1);
                            break;
                        }
                    } catch (e) {
                        console.error('cannot decode: ' + xml);
                        console.error(e);
                    }
                }
            }
        }
        return lines.join('\n');
    }

    function editScript(id) {
        that.initEditor();

        if (that.currentId !== id) {
            if (that.changed) {
                that.main.confirmMessage(_('Script not saved'), _('Save?'), 'help', [_('Save'), _('Discard'), _('Cancel')], function (result) {
                    if (result === 0) {
                        that.saveScript();
                        that.changed = false;
                        setTimeout(function() {
                            editScript(id);
                        }, 0);
                    } else if (result === 1) {
                        that.changed = false;
                        setTimeout(function() {
                            editScript(id);
                        }, 0);
                    } else {
                        that.$grid.selectId('show', that.currentId);
                    }
                });
                return;
            }

            that.currentId = id;
            $('#script-output').html('');
            main.saveConfig('script-editor-current-id', that.currentId);
        }

        if (id && main.objects[id] && main.objects[id].type === 'script') {
            $('#editor-scripts').show();
            applyResizableV('editor-scripts-textarea');
            var obj = main.objects[id];

            $('.script-edit').show();

            if (id.match(/^script\.js\.global/)) {
                $('#global_hint').show();
            } else {
                $('#global_hint').hide();
            }

            $('#edit-script-group').val(getGroup(id));

            $('#edit-script-name').val(obj.common.name);

            $('#edit-script-debug').prop('checked', !!obj.common.debug);
            $('#edit-script-verbose').prop('checked', !!obj.common.verbose);

            that.editor.getSession().setUseWrapMode($('#edit-wrap-lines').prop('checked'));

            if (obj.common.engineType !== 'Blockly') {
                // remove Blockly from list
                $('#edit-script-engine-type').find('option[value="Blockly"]').remove();
            } else {
                if (!$('#edit-script-engine-type').find('option[value="Blockly"]').length) {
                    $('#edit-script-engine-type').prepend('<option value="Blockly">Blockly</option>');
                }
            }
            that.currentEngine = obj.common.engineType;

            // Add engine even if it is not installed
            if (that.engines.indexOf(obj.common.engineType) === -1) {
                $('#edit-script-engine-type').append('<option value="' + obj.common.engineType + '">' + obj.common.engineType + '</option>');
            }

            $('#edit-script-engine-type').val(obj.common.engineType);

            if (obj.common.engineType === 'Blockly') {
                that.editor.getSession().setMode('ace/mode/javascript');
                that.editor.setReadOnly(true);
                that.editor.getSession().setUseWorker(false); // disable syntax check
                switchViews(true, obj.common.engineType);
                that.blocklyWorkspace.clear();
                try {
                    var xml = jsCode2Blockly(obj.common.source) || '<xml xmlns="http://www.w3.org/1999/xhtml"></xml>';
                    var dom = Blockly.Xml.textToDom(xml);
                    Blockly.Xml.domToWorkspace(dom, that.blocklyWorkspace);
                } catch (e) {
                    console.error(e);
                    window.alert('Cannot extract Blockly code!');
                }
            } else
            if (obj.common.engineType && obj.common.engineType.match(/^[jJ]ava[sS]cript/)) {
                that.editor.getSession().setMode('ace/mode/javascript');
                that.editor.getSession().setUseWorker(true); // enable syntax check
                that.editor.setReadOnly(false);
                switchViews(false, obj.common.engineType);
            } else if (obj.common.engineType && obj.common.engineType.match(/^[cC]offee[sS]cript/)) {
                that.editor.getSession().setMode('ace/mode/coffee');
                that.editor.getSession().setUseWorker(true); // enable syntax check
                that.editor.setReadOnly(false);
                switchViews(false, obj.common.engineType);
            }

            that.changed = false;

            //$('#edit-script-source').val(obj.common.source);
            that.editor.setValue(obj.common.source, -1);

            applyResizableV();

            setTimeout(function () {
                that.changed = false;
                $('#script-edit-button-save').button('disable');
                $('#script-edit-button-cancel').button('disable');
                //that.editor.focus();
            }, 100);
        } else
        if (id && main.objects[id] && main.objects[id].type === 'channel' && id !== 'script.js.global' && id !== 'script.js.common') {
            $('#editor-scripts').show();

            var obj = main.objects[id];

            $('#edit-script-group').val(getGroup(id));

            $('#edit-script-name').val(obj.common.name);

            $('#edit-script-debug').prop('checked', !!obj.common.debug);
            $('#edit-script-verbose').prop('checked', !!obj.common.verbose);

            that.changed = false;
            $('#editor-scripts-textarea').height(100);
            if ($('#editor-scripts-textarea').hasClass('ui-resizable')) $('#editor-scripts-textarea').resizable('destroy');

            switchViews(false, null);

            $('#script-edit-button-save').button('disable');
            $('#script-edit-button-cancel').button('disable');
        } else {
            $('#editor-scripts').hide();
        }

        setTimeout(function () {
            that.resize();
        }, 100)
    }

    function blocklyBlinkBlock(block) {
        for (var i = 300; i < 3000; i = i + 300) {
            setTimeout(function () {
                block.select();
            }, i);
            setTimeout(function () {
                block.unselect();
            }, i + 150);
        }
    }

    function blocklyCheckBlocks(cb) {
        var warningText;
        if (that.blocklyWorkspace.getAllBlocks().length === 0) {
            cb && cb('no blocks found');
            return;
        }
        var badBlock = blocklyGetUnconnectedBlock();
        if (badBlock) {
            warningText = 'not properly connected';
        } else {
            badBlock = blocklyGetBlockWithWarning();
            if (badBlock) warningText = 'warning on this block';
        }

        if (badBlock) {
            if (cb) {
                cb(warningText, badBlock);
            } else {
                blocklyBlinkBlock(badBlock);
            }
            return false;
        }

        cb();

        return true;
    }

    //get unconnected block
    function blocklyGetUnconnectedBlock () {
        var blocks = that.blocklyWorkspace.getAllBlocks();
        for (var i = 0, block; block = blocks[i]; i++) {
            var connections = block.getConnections_(true);
            for (var j = 0, conn; conn = connections[j]; j++) {
                if (!conn.sourceBlock_ || ((conn.type === Blockly.INPUT_VALUE || conn.type === Blockly.OUTPUT_VALUE) && !conn.targetConnection && !conn._optional)) {
                    return block;
                }
            }
        }
        return null;
    }

    //get block with warning
    function blocklyGetBlockWithWarning() {
        var blocks = that.blocklyWorkspace.getAllBlocks();
        for (var i = 0, block; block = blocks[i]; i++) {
            if (block.warning) {
                return block;
            }
        }
        return null;
    }

    // Find all script engines
    this.fillEngines = function (elemName) {
        var _engines = [];
        for (var t = 0; t < that.main.instances.length; t++) {
            if (that.main.objects[that.main.instances[t]] && that.main.objects[that.main.instances[t]].common && that.main.objects[that.main.instances[t]].common.engineTypes) {
                var engineTypes = that.main.objects[that.main.instances[t]].common.engineTypes;
                if (typeof engineTypes === 'string') {
                    if (_engines.indexOf(engineTypes) === -1) _engines.push(engineTypes);
                } else {
                    for (var z = 0; z < engineTypes.length; z++) {
                        if (_engines.indexOf(engineTypes[z]) === -1) _engines.push(engineTypes[z]);
                    }
                }
            }
        }

        if (elemName) {
            var text = '';
            for (var u = 0; u < _engines.length; u++) {
                text += '<option value="' + _engines[u] + '">' + _engines[u] + '</option>';
            }
            $('#' + elemName).html(text);
        }
        return _engines;
    };

    function getGroup(id) {
        var parts = id.split('.');
        parts.pop();
        return parts.join('.');
    }

    function fillGroups(elemName) {
        var groups = ['script.js', 'script.js.common', 'script.js.global'];

        for (var i = 0; i < that.list.length; i++) {
            var g = getGroup(that.list[i]);
            if (groups.indexOf(g) === -1 ) groups.push(g);
        }
        for (var j = 0; j < that.groups.length; j++) {
            if (groups.indexOf(that.groups[j]) === -1) groups.push(that.groups[j]);
        }
        var text = '';

        for (g = 0; g < groups.length; g++) {
            var name = groups[g].substring('script.js.'.length);
            if (name === 'global' || name === 'common') {
                name = _(name);
            }

            if (!name) name = _('no group');

            if (that.main.objects[groups[g]] && that.main.objects[groups[g]].common && that.main.objects[groups[g]].common.name) {
                name = that.main.objects[groups[g]].common.name;
            }

            text += '<option value="' + groups[g] + '">' + name + '</option>\n';
            // create group if not exists
            if (groups[g] !== 'script.js' && groups[g] !== 'script' && (!that.main.objects[groups[g]] || !that.main.objects[groups[g]].common)) {
                that.main.socket.emit('setObject', groups[g], {
                    common: {
                        name: groups[g].split('.').pop()
                    },
                    type: 'channel'
                }, function (err) {
                    if (err) {
                        that.main.showError(err);
                        that.init(true);
                    }
                });
            }
        }

        if (elemName) {
            var val = $('#' + elemName).val();
            $('#' + elemName).html(text).val(val);
        }
    }

    this.updateScript = function (oldId, newId, newCommon, cb) {
        this.main.socket.emit('getObject', oldId, function (err, _obj) {
            setTimeout(function () {
                var obj = {common: {}};

                if (newCommon.engine  !== undefined) obj.common.engine  = newCommon.engine;
                if (newCommon.enabled !== undefined) obj.common.enabled = newCommon.enabled;
                if (newCommon.source  !== undefined) obj.common.source  = newCommon.source;
                if (newCommon.debug   !== undefined) obj.common.debug   = newCommon.debug;
                if (newCommon.verbose !== undefined) obj.common.verbose = newCommon.verbose;

                if (oldId === newId && _obj && _obj.common && newCommon.name === _obj.common.name) {
                    if (!newCommon.engineType || newCommon.engineType !== _obj.common.engineType) {
                        if (newCommon.engineType !== undefined) obj.common.engineType  = newCommon.engineType || 'Javascript/js';

                        that.main.socket.emit('extendObject', oldId, obj, function (err) {
                            if (err) {
                                that.main.showError(err);
                                that.init(true);
                            }
                            cb && cb(err);
                        });
                    } else {
                        that.main.socket.emit('extendObject', oldId, obj, function (err) {
                            if (err) {
                                that.main.showError(err);
                                that.init(true);
                            }
                            cb && cb(err);
                        });
                    }
                } else {
                    //var prefix;

                    _obj.common.engineType = newCommon.engineType || _obj.common.engineType || 'Javascript/js';
                    var parts = _obj.common.engineType.split('/');

                    //prefix = 'script.' + (parts[1] || parts[0]) + '.';

                    if (_obj) {
                        that.main.socket.emit('delObject', oldId, function (err) {
                            if (err) {
                                that.main.showError(err);
                                that.init(true);
                            }
                        });
                        if (obj.common.engine  !== undefined) _obj.common.engine  = obj.common.engine;
                        if (obj.common.enabled !== undefined) _obj.common.enabled = obj.common.enabled;
                        if (obj.common.source  !== undefined) _obj.common.source  = obj.common.source;
                        if (obj.common.name    !== undefined) _obj.common.name    = obj.common.name;
                        if (obj.common.debug   !== undefined) _obj.common.debug   = obj.common.debug;
                        if (obj.common.verbose !== undefined) _obj.common.verbose = obj.common.verbose;

                        delete _obj._rev;
                    } else {
                        _obj = obj;
                    }

                    // Name must always exist
                    _obj.common.name = newCommon.name;

                    _obj._id = newId; // prefix + newCommon.name.replace(/[\s"']/g, '_');

                    that.main.socket.emit('setObject', newId, _obj, function (err) {
                        if (err) {
                            that.main.showError(err);
                            that.init(true);
                        } else {
                            setTimeout(function () {
                                that.$grid.selectId('show', newId);
                            }, 500);
                        }
                        cb && cb(err);
                    });
                }
            }, 0);
        });
    };

    function switchViews(isBlocklyView, engineType) {
        if (engineType === null) {
            $('#script-buttons').hide();
            $('.script-edit').hide();
            $('#show-blockly-id').hide();
            $('#script-editor').hide();
            $('#blockly-editor').hide();
            $('.edit-wrap-lines').hide();
            $('.blocklyWidgetDiv').hide();
            $('.blocklyTooltipDiv').hide();
            $('.blocklyToolboxDiv').hide();
            $('#edit-check-blocks').hide();
            $('#edit-export-blocks').hide();
            $('#edit-import-blocks').hide();
            return;
        }
        $('.script-edit').show();
        $('#script-buttons').show();
        engineType = engineType || 'Blockly';

        if (engineType === 'Blockly') {
            if (isBlocklyView === undefined) isBlocklyView = !$('#script-editor').is(':visible');

            if (isBlocklyView) {
                $('#show-blockly-id')
                    .button('option', 'label', _('Show code'))
                    .button('option', 'icons', {primary: 'ui-icon-script'}).show();

                $('#script-editor').hide();
                $('#blockly-editor').show();
                $('.blocklyWidgetDiv').show();
                $('.blocklyTooltipDiv').show();
                $('.blocklyToolboxDiv').show();
                $('.edit-wrap-lines').hide();
                $('#edit-check-blocks').show();
                $('#edit-export-blocks').show();
                $('#edit-import-blocks').show();
                if (that.blocklyWorkspace) Blockly.svgResize(that.blocklyWorkspace);
            } else {
                $('#show-blockly-id')
                    .button('option', 'label', _('Show blockly'))
                    .button('option', 'icons', {primary: 'ui-icon-calculator'}).show();

                // update script editor
                $('#script-editor').show();
                $('#blockly-editor').hide();
                $('.blocklyWidgetDiv').hide();
                $('.blocklyTooltipDiv').hide();
                $('.blocklyToolboxDiv').hide();
                $('.edit-wrap-lines').show();
                $('#edit-check-blocks').hide();
                $('#edit-export-blocks').hide();
                $('#edit-import-blocks').hide();
            }
        } else {
            $('#show-blockly-id').hide();
            $('#script-editor').show();
            $('#blockly-editor').hide();
            $('.edit-wrap-lines').show();
            $('.blocklyWidgetDiv').hide();
            $('.blocklyTooltipDiv').hide();
            $('.blocklyToolboxDiv').hide();
            $('#edit-check-blocks').hide();
            $('#edit-export-blocks').hide();
            $('#edit-import-blocks').hide();
        }
    }

    this.initEditor = function () {
        if (!this.editor) {
            this.editor       = ace.edit('script-editor');
            this.editorDialog = ace.edit('dialog-script-editor');

            //this.editor.setTheme("ace/theme/monokai");
            this.editor.getSession().setMode('ace/mode/javascript');
            this.editor.$blockScrolling = Infinity;

            this.editorDialog.getSession().setMode('ace/mode/javascript');
            this.editorDialog.$blockScrolling = Infinity;

            $('#dialog-edit-insert-id').button({
                icons: {primary: 'ui-icon-note'}
            }).css('height', '30px').click(function () {
                var sid = that.main.initSelectId();
                sid.selectId('show', function (newId) {
                    that.editorDialog.insert('"' + newId + '"' + ((that.main.objects[newId] && that.main.objects[newId].common && that.main.objects[newId].common.name) ? ('/*' + that.main.objects[newId].common.name + '*/') : ''));
                    that.editorDialog.focus();
                });
            });

            $('#edit-insert-id').button({
                icons: {primary: 'ui-icon-note'}
            }).css('height', '30px').click(function () {
                var sid = that.main.initSelectId();
                sid.selectId('show', function (newId) {
                    that.editor.insert('"' + newId + '"' + ((that.main.objects[newId] && that.main.objects[newId].common && that.main.objects[newId].common.name) ? ('/*' + that.main.objects[newId].common.name + '*/') : ''));
                    that.editor.focus();
                });
            });

            $('.edit-cron-id').button({
                icons: {primary: 'ui-icon-clock'}
            }).css('height', '30px').click(function () {
                var text;
                if (!$('#dialog-script').is(':visible')) {
                    text = that.editor.getSession().doc.getTextRange(that.editor.selection.getRange());
                } else {
                    text = that.editorDialog.getSession().doc.getTextRange(that.editor.selection.getRange());
                }
                if (text) {
                    text = text.replace(/\"/g, '').replace(/\'/g, '');
                    if (text) {
                        try {
                            $('#div-cron').cron('value', text);
                        } catch (e) {
                            alert(_('Cannot parse text as cron message'));
                        }
                    }
                }

                $('#dialog_cron_callback').hide();
                $('#dialog_cron_insert').show();
                that.$dialogCron.dialog('open');
            });

            // toggle blockly <=> javascript
            $('#show-blockly-id').button({
                icons: {primary: 'ui-icon-script'}
            }).css({height: 30, width: 200}).click(function () {
                if ($('#script-editor').is(':visible')) {
                    switchViews(true);
                } else {
                    blocklyCode2JSCode();
                    switchViews(false);
                }
            });

            this.editor.on('input', function() {
                if (that.currentEngine !== 'Blockly') {
                    that.changed = true;
                    $('#script-edit-button-save').button('enable');
                    $('#script-edit-button-cancel').button('enable');
                }
            });

            this.editorDialog.on('input', function() {
                that.editorDialog._changed = true;
                $('#dialog_script_save').button('enable');
            });

            $('#edit-script-name').change(function () {
                that.changed = true;
                $('#script-edit-button-save').button('enable');
                $('#script-edit-button-cancel').button('enable');
            }).keyup(function () {
                $(this).trigger('change');
            });

            $('#edit-script-debug').change(function () {
                if ($(this).prop('checked')) {
                    that.main.showMessage(_('debug_help'));
                }
                that.changed = true;
                $('#script-edit-button-save').button('enable');
                $('#script-edit-button-cancel').button('enable');
            });
            $('#edit-script-verbose').change(function () {
                if ($(this).prop('checked')) {
                    that.main.showMessage(_('verbose_help'));
                }

                that.changed = true;
                $('#script-edit-button-save').button('enable');
                $('#script-edit-button-cancel').button('enable');
            });

            $('#edit-script-engine-type').change(function () {
                if (that.currentEngine === 'Blockly' && that.editor.getValue()) {
                    main.confirmMessage(_('You cannot go back!'), null, null, function (result) {
                        if (result) {
                            that.currentEngine = $('#edit-script-engine-type').val();
                            blockly2JS(true);
                        } else {
                            // return value back
                            $('#edit-script-engine-type').val('Blockly');
                        }
                    });
                    return;
                }

                if (that.currentEngine === 'Blockly') {
                    that.currentEngine = $(this).val();
                    switchViews(false, that.currentEngine);
                    blockly2JS(true);
                } else {
                    that.currentEngine = $(this).val();
                    switchViews(false, that.currentEngine);
                }

                that.changed = true;
                $('#script-edit-button-save').button('enable');
                $('#script-edit-button-cancel').button('enable');
            });
            $('#edit-script-group').change(function () {
                that.changed = true;
                $('#script-edit-button-save').button('enable');
                $('#script-edit-button-cancel').button('enable');
            });

            this.editor.getSession().setUseWrapMode($('#edit-wrap-lines').prop('checked'));
        }
    };

    function _deleteGroup(id, originalGroup, confirmed) {
        confirmed.push(id);
        // find all elements
        for (var l = 0; l < that.list.length; l++) {
            if (that.list[l].substring(0, id.length + 1) === id + '.') {
                deleteId(that.list[l], id, confirmed);
                return;
            }
        }
        for (var g = 0; g < that.groups.length; g++) {
            if (that.groups[g].substring(0, id.length + 1) === id + '.') {
                deleteId(that.groups[g], id, confirmed);
                return;
            }
        }
        that.main.socket.emit('delObject', id, function (err) {
            if (err) {
                if (err) {
                    that.main.showError(err);
                    that.init(true);
                }
            } else if (originalGroup !== id) {
                setTimeout(function () {
                    deleteId(originalGroup, null, confirmed);
                }, 0);
            } else {
                // finish
            }
        });
    }
    function deleteId(id, originalGroup, confirmed) {
        originalGroup = originalGroup || id;
        confirmed = confirmed || [];

        if (that.main.objects[id] && that.main.objects[id].type === 'script') {
            that.main.confirmMessage(_('Are you sure to delete script %s?', that.main.objects[id].common.name), null, 'help', function (result) {
                if (result) {
                    that.main.socket.emit('delObject', id, function (err) {
                        if (err) {
                            if (err) {
                                that.main.showError(err);
                                that.init(true);
                            }
                        } else {
                            setTimeout(function () {
                                deleteId(originalGroup, null, confirmed);
                            }, 0);
                        }
                    });
                } else {

                }
            });
        } else {
            var name = id;
            if (confirmed.indexOf(id) === -1) {
                if (that.main.objects[id] && that.main.objects[id].common && that.main.objects[id].common.name) name = that.main.objects[id].common.name;

                that.main.confirmMessage(_('Are you sure to delete group <span style="color: blue">%s</span> and <span style="color: red">all</span> scripts in it?', name), null, 'help', function (result) {
                    if (result) {
                        _deleteGroup(id, originalGroup, confirmed);
                    }
                });
            } else {
                _deleteGroup(id, originalGroup, confirmed);
            }
        }
    }

    function renameGroup(id, newId, newName, _list, cb) {
        if (typeof _list === 'function') {
            cb = _list;
            _list = null;
        }
        if (!_list) {
            _list = [];

            that.renaming = true;
            // collect all elements to rename
            // find all elements
            for (var l = 0; l < that.list.length; l++) {
                if (that.list[l].substring(0, id.length + 1) === id + '.') _list.push(that.list[l]);
            }
            for (var g = 0; g < that.groups.length; g++) {
                if (that.groups[g].substring(0, id.length + 1) === id + '.') _list.push(that.list[l]);
            }

            that.main.socket.emit('getObject', id, function (err, obj) {
                if (err) {
                    that.renaming = false;
                    that.main.showError(err);
                    that.init(true);
                    cb && cb(err);
                } else {
                    obj = obj || {common: {}};
                    obj.common.name = newName;
                    obj._id = newId;

                    that.main.socket.emit('delObject', id, function (err) {
                        if (err) {
                            that.renaming = false;
                            that.main.showError(err);
                            that.init(true);
                            cb && cb(err);
                        } else {
                            that.main.socket.emit('setObject', newId, obj, function (err) {
                                if (err) {
                                    that.renaming = false;
                                    that.main.showError(err);
                                    that.init(true);
                                    cb && cb(err);
                                } else {
                                    setTimeout(function () {
                                        renameGroup(id, newId, newName, _list, cb);
                                    }, 0);
                                }
                            });
                        }
                    });
                }
            });
        } else {
            if (_list.length) {
                var nId = _list.pop();

                that.main.socket.emit('getObject', nId, function (err, obj) {
                    if (err) {
                        that.renaming = false;
                        that.main.showError(err);
                        that.init(true);
                        cb && cb(err);
                    } else {
                        that.main.socket.emit('delObject', nId, function (err) {
                            if (err) {
                                that.renaming = false;
                                that.main.showError(err);
                                that.init(true);
                                cb && cb(err);
                            } else {
                                nId = newId + nId.substring(id.length);
                                that.main.socket.emit('setObject', nId, obj, function (err) {
                                    if (err) {
                                        that.renaming = false;
                                        that.main.showError(err);
                                        that.init(true);
                                        cb && cb(err);
                                    } else {
                                        setTimeout(function () {
                                            renameGroup(id, newId, newName, _list, cb);
                                        }, 0);
                                    }
                                });
                            }
                        });
                    }

                });
            } else {
                fillGroups('edit-script-group');
                that.$grid.selectId('reinit');
                applyResizableH(true, 1000);
                cb && cb();
            }
        }
    }

    function getLiveHost () {
        var _hosts = [];
        for (var h = 0; h < that.hosts.length; h++) {
            if (main.states[that.hosts[h] + '.alive'] && main.states[that.hosts[h] + '.alive'].val) {
                return that.hosts[h];
            }

        }
        return '';
    }

    function exportScripts() {
        var host = getLiveHost();
        if (!host) {
            window.alert('No active host found');
            return;
        }
        main.socket.emit('sendToHost', host, 'readObjectsAsZip', {
            adapter: 'javascript',
            id:      'script.js'
        }, function (data) {
            if (data.error) console.error(data.error);
            if (data.data) {
                var d = new Date();
                var date = d.getFullYear();
                var m = d.getMonth() + 1;
                if (m < 10) m = '0' + m;
                date += '-' + m;
                m = d.getDate();
                if (m < 10) m = '0' + m;
                date += '-' + m + '-';

                $('body').append('<a id="zip_download" href="data: application/zip;base64,' + data.data + '" download="' + date + 'scripts.zip"></a>');
                document.getElementById('zip_download').click();
                document.getElementById('zip_download').remove();
            }
        });
    }

    function editGetReadableSize (bytes) {
        var text;
        if (bytes < 1024) {
            text = bytes + ' ' + _('bytes');
        } else if (bytes < 1024 * 1024) {
            text = Math.round(bytes * 10 / 1024) / 10 + ' ' + _('Kb');
        } else {
            text = Math.round(bytes * 10 / (1024 * 1024)) / 10 + ' ' + _('Mb');
        }
        if (main.systemConfig.common.isFloatComma) text = text.replace('.', ',');
        return text;
    }

    function fileHandler (event) {
        event.preventDefault();
        var file = event.dataTransfer ? event.dataTransfer.files[0] : event.target.files[0];

        var $dz = $('.import-drop-zone').show();
        if (!file || !file.name || !file.name.match(/\.zip$/)) {
            $('.import-drop-text').html(_('Invalid file extenstion!'));
            $dz.addClass('import-dropzone-error').animate({opacity: 0}, 1000, function () {
                $dz.hide().removeClass('import-dropzone-error').css({opacity: 1});
                $('.import-drop-text').html(_('Drop the files here'));
            });
            return false;
        }

        if (file.size > 50000000) {
            $('.import-drop-text').html(_('File is too big!'));
            $dz.addClass('import-dropzone-error').animate({opacity: 0}, 1000, function () {
                $dz.hide().removeClass('import-dropzone-error').css({opacity: 1});
                $('.import-drop-text').html(_('Drop the files here'));
            });
            return false;
        }
        $dz.hide();
        var that = this;
        var reader = new FileReader();
        reader.onload = function (evt) {
            $('.import-file-name').html('<img src="zip.png" /><br><span style="color: black; font-weight: bold">[' + editGetReadableSize(file.size) + ']</span><br><span style="color: black; font-weight: bold">' + file.name + '</span>');
            // string has form data:;base64,TEXT==
            $('.import-file-name').data('file', evt.target.result.split(',')[1]);
            $('.import-text-drop-plus').hide();
            if ($('.import-file-name').data('file')) {
                $('#start_import_scripts').button('enable');
            } else {
                $('#start_import_scripts').button('disable');
            }
        };
        reader.readAsDataURL(file);
    }

    function importScripts() {
        $('#dialog_import_scripts').dialog({
            autoOpen:   true,
            resizable: false,
            width:      600,
            height:     280,
            modal:      true,
            open: function (event, ui) {
                $(event.target).parent().find('.ui-dialog-titlebar-close .ui-button-text').html('');
                $('[aria-describedby="dialog_import_scripts"]').css('z-index', 1002);
                $('.ui-widget-overlay').css('z-index', 1001);
                $('.import-file-name').data('file', null).html(_('Drop files here or click to select one'));
                $('#start_import_scripts').button('disable');
                $('.import-drop-file').val('');
                $('.import-text-drop-plus').show();

                var $dropZone = $('#dialog_import_scripts');
                if (typeof(window.FileReader) !== 'undefined' && !$dropZone.data('installed')) {
                    $dropZone.data('installed', true);
                    var $dz = $('.import-drop-zone');
                    $('.import-drop-text').html(_('Drop the files here'));
                    $dropZone[0].ondragover = function() {
                        $dz.unbind('click');
                        $dz.show();
                        return false;
                    };
                    $dz.click(function () {
                        $dz.hide();
                    });

                    $dz[0].ondragleave = function() {
                        $dz.hide();
                        return false;
                    };

                    $dz[0].ondrop = function (e) {
                        fileHandler(e);
                    }
                }
            }
        });
    }

    function initBlocklyDialog(title) {
        if (!that.$dialogExport.data('inited')) {
            that.$dialogExport.dialog({
                autoOpen:   false,
                modal:      true,
                width:      700,
                height:     400,
                resizable:  false,
                title:      _('Export selected blocks'),
                close: function () {
                    $('#dialog-export-blockly-textarea').val('');
                },
                open: function () {
                    $(event.target).parent().find('.ui-dialog-titlebar-close .ui-button-text').html('');
                    $('#dialog-export-blockly-textarea').focus();
                },
                buttons: [
                    {
                        id: 'blockly-export-button-ok',
                        text: _('Ok'),
                        click: function () {
                            var val = $('#dialog-export-blockly-textarea').val();
                            if (val.trim()) {
                                try {
                                    var xmlBlocks = Blockly.Xml.textToDom(val);
                                    if (xmlBlocks.nodeName === 'xml') {
                                        for (var b = 0; b < xmlBlocks.children.length; b++) {
                                            that.blocklyWorkspace.paste(xmlBlocks.children[b]);
                                        }
                                    } else {
                                        that.blocklyWorkspace.paste(xmlBlocks);
                                    }
                                    that.$dialogExport.dialog('close');
                                } catch (e) {
                                    that.main.showError(e, _('Import error'));
                                }
                            } else {
                                that.main.showMessage(_('Nothing imported'));
                                that.$dialogExport.dialog('close');
                            }
                        }
                    },
                    {
                        text: _('Cancel'),
                        click: function () {
                            that.$dialogExport.dialog('close');
                        }
                    }
                ]
            });
            that.$dialogExport.data('inited', true);
        }
        that.$dialogExport.dialog('option', 'title',  title || _('Export selected blocks'));
    }
    function showExportBlocklyDialog() {
        initBlocklyDialog(_('Export selected blocks'));
        if (Blockly.selected) {
            var xmlBlock = Blockly.Xml.blockToDom(Blockly.selected);
            if (Blockly.dragMode_ != Blockly.DRAG_FREE) {
                Blockly.Xml.deleteNext(xmlBlock);
            }
            // Encode start position in XML.
            var xy = Blockly.selected.getRelativeToSurfaceXY();
            xmlBlock.setAttribute('x', Blockly.selected.RTL ? -xy.x : xy.x);
            xmlBlock.setAttribute('y', xy.y);

            $('#dialog-export-blockly-textarea').val(Blockly.Xml.domToPrettyText(xmlBlock)).prop('readonly', true).select();
        } else {
            var dom = Blockly.Xml.workspaceToDom(that.blocklyWorkspace);
            var text = Blockly.Xml.domToPrettyText(dom);
            $('#dialog-export-blockly-textarea').val(text).prop('readonly', true).select()
        }
        $('#blockly-export-button-ok').hide();
        that.$dialogExport.dialog('open');
    }

    function showImportBlocklyDialog() {
        initBlocklyDialog(_('Import selected blocks'));
        $('#blockly-export-button-ok').show();
        $('#dialog-export-blockly-textarea').prop('readonly', false).val('');
        that.$dialogExport.dialog('open');
    }

    function loadScripts(scripts, callback) {
        if (!scripts || !scripts.length) {
            return callback();
        }
        var adapter = scripts.pop();
        $.getScript('../../adapter/' + adapter + '/blockly.js', function (/*data, textStatus, jqxhr*/) {
            setTimeout(function () {
                loadScripts(scripts, callback);
            }, 0);
        }).fail(function (jqxhr, settings, exception) {
            console.warn('cannot load ' + '../../adapter/' + adapter + '/blockly.js: ' + exception);
            setTimeout(function () {
                loadScripts(scripts, callback);
            }, 0);
        });
    }

    function loadCustomBlockly(callback) {
        // get all adapters, that can have blockly
        var toLoad = [];
        for (var id in that.main.objects) {
            if (!that.main.objects.hasOwnProperty(id) || !that.main.objects[id]) continue;
            if (!id.match(/^system\.adapter\./)) continue;
            if (that.main.objects[id].type !== 'adapter') continue;
            if (that.main.objects[id].common && that.main.objects[id].common.blockly) {
                toLoad.push(that.main.objects[id].common.name);
            }
        }

        loadScripts(toLoad, callback);
    }

    this.init = function (update) {
        var that = this;
        if (!this.main.objectsLoaded || !this.languageLoaded) {
            setTimeout(function () {
                that.init(update);
            }, 250);
            return;
        }

        if (!$('#blockly-editor').data('inited')) {
            $('#blockly-editor').data('inited', true);
            loadCustomBlockly(function () {
                MSG.catSystem = Blockly.Words['System'][systemLang];
                MSG.catSendto = Blockly.Words['Sendto'][systemLang];

                // Interpolate translated messages into toolbox.
                var toolboxText = document.getElementById('toolbox').outerHTML;
                toolboxText = toolboxText.replace(/{(\w+)}/g,
                    function(m, p1) {return MSG[p1]});

                var blocks = '';
                for (var cb = 0; cb < Blockly.CustomBlocks.length; cb++) {
                    var name = Blockly.CustomBlocks[cb];
                    // add blocks
                    blocks += '<category name="' + Blockly.Words[name][systemLang] + '" colour="' + Blockly[name].HUE + '">';
                    for (var _b in Blockly[name].blocks) {
                        blocks += Blockly[name].blocks[_b];
                    }
                    blocks += '</category>';
                }
                toolboxText = toolboxText.replace('<category><block>%%CUSTOM_BLOCKS%%</block></category>', blocks);

                var toolboxXml = Blockly.Xml.textToDom(toolboxText);

                that.blocklyWorkspace = Blockly.inject(
                    'blockly-editor',
                    {
                        media: '/adapter/javascript/google-blockly/media/',
                        toolbox: toolboxXml,
                        zoom: {
                            controls:   true,
                            wheel:      false,
                            startScale: 1.0,
                            maxScale:   3,
                            minScale:   0.3,
                            scaleSpeed: 1.2
                        },
                        trashcan: true,
                        grid: {
                            spacing:    25,
                            length:     3,
                            colour:     '#ccc',
                            snap:       true
                        }
                    }
                );
                // Listen to events on master workspace.
                that.blocklyWorkspace.addChangeListener(function (masterEvent) {
                    if (masterEvent.type === Blockly.Events.UI) {
                        return;  // Don't mirror UI events.
                    }
                    that.changed = true;
                    $('#script-edit-button-save').button('enable');
                    $('#script-edit-button-cancel').button('enable');
                });
            });
        }

        if (typeof this.$grid !== 'undefined' && (!this.$grid.data('inited') || update)) {
            this.$grid.data('inited', true);

            that.engines = this.fillEngines('edit-script-engine-type');

            this.$grid.selectId('init', {
                objects:        main.objects,
                noDialog:       true,
                texts:          {
                    select:   _('Select'),
                    cancel:   _('Cancel'),
                    all:      _('All'),
                    id:       _('Scripts'),
                    name:     _('Name'),
                    role:     _('Role'),
                    room:     _('Room'),
                    value:    _('Value'),
                    type:     _('Type'),
                    selectid: _('Select ID'),
                    from:     _('From'),
                    lc:       _('Last changed'),
                    ts:       _('Time stamp'),
                    wait:     _('Processing...'),
                    ack:      _('Acknowledged'),
                    edit:     _('Edit'),
                    ok:       _('Ok'),
                    enum:     _('Members')
                },
                noCopyToClipboard: true,
                root:           'script.js.',
                useNameAsId:    true,
                noColumnResize: true,
                firstMinWidth:  '*',
                columns: [
                    {
                        name: 'instance',
                        data: function (id, name) {
                            return that.main.objects[id] && that.main.objects[id].common && that.main.objects[id].common.engine ? that.main.objects[id].common.engine.substring('system.adapter.javascript.'.length) : '';
                        },
                        title: function (id, name) {
                            return that.main.objects[id] && that.main.objects[id].common && that.main.objects[id].common.engine ? _('Instance')  + ' ' + that.main.objects[id].common.engine : '';
                        }
                    },
                    'button'
                ],
                widths:  ['100px', '140px'],
                buttons: [
                    {
                        text: false,
                        icons: {
                            primary:'ui-icon-play'
                        },
                        click: function (id) {
                            if (this.length === 1) this.button('disable');
                            // toggle state
                            that.main.socket.emit('extendObject', id, {
                                common: {
                                    enabled: !(that.main.objects[id] && that.main.objects[id].common && that.main.objects[id].common.enabled)
                                }
                            }, function (err) {
                                if (err) {
                                    that.main.showError(err);
                                    that.init(true);
                                }
                            });
                        },
                        match: function (id) {
                            if (that.main.objects[id] && that.main.objects[id].type ==='script') {
                                if (that.main.objects[id] && that.main.objects[id].common && that.main.objects[id].common.enabled) {
                                    this.button('option', 'icons', {
                                        primary:'ui-icon-pause'
                                    }).attr('title', _('Activated. Click to stop.')).css({'background-color': 'lightgreen'});
                                } else {
                                    this.button('option', 'icons', {
                                        primary:'ui-icon-play'
                                    }).attr('title', _('Deactivated. Click to start.')).css({'background-color': '#FF9999'});
                                }
                            } else {
                                this.hide();
                            }
                        },
                        width: 26,
                        height: 20
                    },
                    {
                        text: false,
                        icons: {
                            primary:'ui-icon-trash'
                        },
                        click: function (id) {
                            if (!that.main.objects[id] || that.main.objects[id].type !== 'script') {
                                deleteId(id);
                            } else {
                                that.main.confirmMessage(_('Are you sure to delete script %s?', that.main.objects[id].common.name), null, 'help', function (result) {
                                    if (result) that.main.socket.emit('delObject', id);
                                });
                            }
                        },
                        match: function (id) {
                            if (!main.objects[id] || !main.objects[id].common || main.objects[id].common.nondeletable) this.hide();
                        },
                        width: 26,
                        height: 20
                    },
                    {
                        text: false,
                        icons: {
                            primary:'ui-icon-copy'
                        },
                        click: function (id) {
                            that.main.socket.emit('getObject', id, function (err, obj) {
                                if (err) {
                                    that.main.showError(err);
                                    return;
                                }
                                // find new name
                                var i = 0;
                                //build name
                                var newId;
                                do {
                                    i++;
                                    if (obj._id.match(/\(\d+\)/)) {
                                        newId = obj._id.replace(/\(\d+\)/, '(' + i + ')');
                                    } else {
                                        newId = obj._id + '(' + i + ')';
                                    }
                                } while (that.list.indexOf(newId) !== -1);

                                obj._id = newId;
                                that.main.socket.emit('setObject', newId, obj, function (err, obj) {
                                    if (err) {
                                        that.main.showError(err);
                                        return;
                                    }
                                });
                            });
                        },
                        match: function (id) {
                            if (!that.main.objects[id] || that.main.objects[id].type !=='script') this.hide();
                        },
                        width: 26,
                        height: 20
                    },
                    {
                        text: false,
                        icons: {
                            primary:'ui-icon-refresh'
                        },
                        click: function (id) {
                            that.main.socket.emit('extendObject', id, {});
                        },
                        match: function (id) {
                            if (!that.main.objects[id] || that.main.objects[id].type !=='script') this.hide();
                        },
                        width: 26,
                        height: 20
                    }
                ],
                panelButtons: [
                    {
                        text: false,
                        title: _('New script'),
                        icons: {
                            primary: 'ui-icon-document'
                        },
                        click: function () {
                            var group = that.currentId || 'script.js';
                            if (that.main.objects[group] && that.main.objects[group].type === 'script') group = getGroup(group);

                            addScript(group);
                        }
                    },
                    {
                        text: false,
                        title: _('New group'),
                        icons: {
                            primary: 'ui-icon-circle-plus'
                        },
                        click: function () {
                            addScriptInGroup(that.currentId);
                        }
                    },
                    {
                        text: false,
                        title: _('Export'),
                        icons: {
                            primary: 'ui-icon-arrowthickstop-1-s'
                        },
                        click: function () {
                            exportScripts();
                        }
                    },
                    {
                        text: false,
                        title: _('Import'),
                        icons: {
                            primary: 'ui-icon-arrowthickstop-1-n'
                        },
                        click: function () {
                            importScripts();
                        }
                    }
                ],
                onChange: function (id, oldId) {
                    if (id !== oldId || !that.editor) {
                        editScript(id);
                    } else {
                        // focus again on editor
                        that.editor.focus();
                    }
                },
                quickEdit: [{
                    name:    'instance',
                    options: function (id, name) {
                        var ins = {};
                        if (that.main.objects[id].type !== 'script') {
                            return false;
                        }
                        for (var i = 0; i < main.instances.length; i++) {
                            if (main.instances[i].substring(0, 'system.adapter.javascript.'.length) === 'system.adapter.javascript.') {
                                var inst = main.instances[i].substring('system.adapter.javascript.'.length);
                                ins[inst] = inst;
                            }
                        }
                        return ins;
                    }
                }],
                quickEditCallback: function (id, attr, newValue, oldValue) {
                    main.socket.emit('getObject', id, function (err, _obj) {
                        if (err) return that.main.showError(err);

                        _obj.common.engine = 'system.adapter.javascript.' + newValue;
                        main.socket.emit('setObject', _obj._id, _obj, function (err) {
                            if (err) that.main.showError(err);
                        });
                    });
                }
            }).selectId('show', update ? undefined : main.config['script-editor-current-id'] || undefined);

            // Show add button
            setTimeout(function () {
                // show blink on start
                var $addNew = $('#btn_custom_0_0');
                var background = $addNew.css('background-color');
                $addNew
                    .css({
                        'background-color': 'red'
                    }, 'red')
                    .animate({'background-color': background}, 500, function () {
                        $addNew.animate({'background-color': 'red'}, 500, function () {
                            $addNew.animate({'background-color': background}, 3000);
                        });
                    });
            }, 500);

            applyResizableH(true);

            if (this.main.config['script-editor-wrap-lines'])        $('#edit-wrap-lines').prop('checked', true);
            if (this.main.config['script-editor-dialog-wrap-lines']) $('#dialog-edit-wrap-lines').prop('checked', true);
            
            $('#edit-check-blocks').button({
                icons: {
                    primary: 'ui-icon-check'
                }
            }).click(function () {
                blocklyCheckBlocks(function (err, badBlock) {
                    if (!err) {
                        that.main.showMessage(_('Ok'));
                    } else {
                        if (badBlock) blocklyBlinkBlock(badBlock);
                        that.main.showError(_(err), function () {
                            if (badBlock) blocklyBlinkBlock(badBlock);
                        });
                    }
                });
            });

            $('#edit-export-blocks')
                .button({
                    icons: {
                        primary: 'ui-icon-arrowthickstop-1-s'
                    },
                    text: false
                })
                .attr('title', _('Export blocks'))
                .css({width: 32, height: 32})
                .click(function () {
                    showExportBlocklyDialog();
                });


            $('#edit-import-blocks')
                .button({
                    icons: {
                        primary: 'ui-icon-arrowthickstop-1-n'
                    },
                    text: false
                })
                .attr('title', _('Import blocks'))
                .css({width: 32, height: 32})
                .click(function () {
                    showImportBlocklyDialog();
                });
        }
    };

    this.saveScript = function (isConvert, cb) {
        var that = this;
        var obj = {};
        var newId      = $('#edit-script-group').val() + '.' + $('#edit-script-name').val().replace(/["'\s.]/g, '_');
        obj.name       = $('#edit-script-name').val();
        obj.engineType = $('#edit-script-engine-type').val() || '';
        obj.debug      = $('#edit-script-debug').prop('checked');
        obj.verbose    = $('#edit-script-verbose').prop('checked');

        // Try to detect blockly type
        if (obj.engineType === 'Blockly') {
            if (!isConvert) {
                obj.source = blocklyCode2JSCode(false, true);
            } else {
                obj.source = that.editor.getValue();
            }
        }

        if (that.currentId !== newId && that.main.objects[newId]) {
            that.main.showError(_('Duplicate name'));
            cb && cb();
            return;
        }

        if (obj.engineType !== 'Blockly') {
            obj.source = that.editor.getValue();
            var blocklyText = jsCode2Blockly(obj.source);
            if (blocklyText && blocklyText.substring(0, 4) === '<xml') {
                // ask about change the script type
                that.main.confirmMessage(_('Convert to Blockly'), _('Convert?'), 'help', function (result) {
                    if (result) {
                        obj.engineType = 'Blockly';
                        if (!$('#edit-script-engine-type').find('option[value="Blockly"]').length) {
                            $('#edit-script-engine-type').prepend('<option value="Blockly">Blockly</option>');
                        }
                        $('#edit-script-engine-type').val(obj.engineType);
                        that.changed = true;

                        that.saveScript(true, function () {
                            setTimeout(function () {
                                editScript(that.currentId);
                            }, 500);
                        });
                    } else {
                        // remove blockly text
                        obj.source = removeBlocklyFromCode(obj.source);
                        that.editor.setValue(obj.source, -1);
                        // wait till editor script updates
                        setTimeout(function () {
                            that.saveScript();
                        }, 300);
                    }
                });
                return;
            }
        }

        that.changed = false;
        $('#script-edit-button-save').button('disable');
        $('#script-edit-button-cancel').button('disable');

        if (that.main.objects[that.currentId] && that.main.objects[that.currentId].type === 'script') {
            that.updateScript(that.currentId, newId, obj, function (err) {
                if (err) {
                    console.error(err);
                    $('#script-edit-button-save').button('enable');
                    $('#script-edit-button-cancel').button('enable');
                }
                cb && cb();
            });
        } else {
            renameGroup(that.currentId, newId, obj.name, function (err) {
                if (err) {
                    console.error(err);
                    $('#script-edit-button-save').button('enable');
                    $('#script-edit-button-cancel').button('enable');
                }
                cb && cb();
            });
        }
        that.currentId = newId;
    };

    this.objectChange = function (id, obj) {
        // Update scripts
        if (id.match(/^script\./)) {
            if (obj) {
                if (this.list.indexOf(id) === -1) this.list.push(id);

                // if script type was changed
                if (id === this.currentId) {
                    if (obj.common.name !== $('#edit-script-name').val()) {
                        $('#edit-script-name').val(obj.common.name);
                    }
                    if (obj.common.engineType !== $('#edit-script-engine-type').val()) {
                        editScript(id);
                    }
                }
            } else {
                // deleted
                var j = this.list.indexOf(id);
                if (j !== -1) this.list.splice(j, 1);
                if (id === this.currentId) {
                    this.changed = false;
                    editScript(null);
                }
            }


            if (this.updateTimer) clearTimeout(this.updateTimer);

            this.updateTimer = setTimeout(function () {
                that.updateTimer = null;
                that.$grid.selectId('reinit');
                applyResizableH(true, 1000);
            }, 200);

            if (this.$grid) this.$grid.selectId('object', id, obj);
        } else
        if (id.match(/^system\.adapter\.[-\w\d]+\.[0-9]+$/)) {
            var val = $('#edit-script-engine-type').val();
            that.engines = that.fillEngines('edit-script-engine-type');
            $('#edit-script-engine-type').val(val);
        }
        else
        if (id.match(/^system\.adapter\.[-\w\d]+\$/)) {
            if (obj[id].common && obj[id].common.blockly) {
                main.confirmMessage(_('Some blocks were updated. Reload admin?'), null, null, 700, function (result) {
                    if (result) {
                        window.location.reload();
                    }
                });
            }
        }

        if (id.match(/^script\.js\./) && obj && obj.type === 'channel') {
            scripts.groups.push(id);
            if (!that.renaming) fillGroups('edit-script-group');
        }
    };

    function getTimeString(d) {
        var text = '';
        var i = d.getHours();
        if (i < 10) i = '0' + i.toString();
        text = i + ':';

        i = d.getMinutes();
        if (i < 10) i = '0' + i.toString();
        text += i + ':';
        i = d.getSeconds();
        if (i < 10) i = '0' + i.toString();
        text += i + '.';
        i = d.getMilliseconds();
        if (i < 10) {
            i = '00' + i.toString();
        } else if (i < 100) {
            i = '0' + i.toString();
        }
        text += i;
        return text;
    }

    this.onLog = function (message) {
        if (!this.$parentOutput) this.$parentOutput = $('#script-output').parent().parent();

        //{"message":"javascript.0 Stop script script.js.Script4","severity":"info","from":"javascript.0","ts":1455490697111,"_id":364}
        if (that.currentId && message.message.indexOf(that.currentId) !== -1) {
            var text = '<tr class="' + message.severity + '"><td>' + getTimeString(new Date(message.ts)) + '</td><td>[' + message.severity + ']</td><td>' + message.message + '</td></tr>';
            var h          = this.$parentOutput.height();

            var oldHeight  = $('#script-output').height();
            var scrollTop  = this.$parentOutput.scrollTop();
            var shiftToEnd = (scrollTop + h >= oldHeight - 5);

            if (oldHeight > 2000) {
                $('#script-output tr:first').remove();
                var oldHeight1 = $('#script-output').height();
                this.$parentOutput.scrollTop(scrollTop - (oldHeight - oldHeight1));

                oldHeight = oldHeight1;
            }

            var scrollTop = this.$parentOutput.scrollTop();
            var shiftToEnd = (scrollTop + h >= oldHeight - 5);

            $('#script-output').append(text);

            if (shiftToEnd) {
                this.$parentOutput.scrollTop(oldHeight + 50);
            }
        }
    };

    this.showCronDialog = function (value, cb) {
        if (value) {
            value = value.replace(/\"/g, '').replace(/\'/g, '');
            if (value) {
                try {
                    $('#div-cron').cron('value', value);
                } catch (e) {
                    alert(_('Cannot parse value as cron'));
                }
            }
        }
        $('#dialog_cron_callback').show();
        $('#dialog_cron_insert').hide();

        $('#dialog_cron_callback').unbind('click').click(function () {
            var val = $('#div-cron').cron('value');
            that.$dialogCron.dialog('close');
            if (cb) cb(val);
        });

        this.$dialogCron.dialog('open');
    };

    this.showScriptDialog = function (value, args, isReturn, cb) {
        this.editorDialog.setValue(value || '', -1);

        var width  = 700;
        var height = 550;

        if (this.main.config['script-edit-width'])  width  = this.main.config['script-edit-width'];
        if (this.main.config['script-edit-height']) height = this.main.config['script-edit-height'];

        this.$dialogScript.data('callback', cb);

        if (args && args.length) {
            this.$dialogScript.dialog('option', 'title', _('Edit script') + '. ' + _('Arguments: ') + args.join(', '));
        } else {
            this.$dialogScript.dialog('option', 'title', _('Edit script'));
        }

        this.editorDialog.getSession().setUseWrapMode($('#dialog-edit-wrap-lines').prop('checked'));
        
        this.$dialogScript
            .dialog('option', 'width',  width)
            .dialog('option', 'height', height)
            .dialog('open');

        this.editorDialog.focus();

        that.editorDialog._isReturn = isReturn;
        
        setTimeout(function () {
            that.editorDialog._changed = false;
            $('#dialog_script_save').button('disable');
        }, 100);
    };
}

var main = {
    socket:         io.connect(),
    saveConfig:     function (attr, value) {
        if (!main.config) return;
        if (attr) main.config[attr] = value;

        if (typeof storage !== 'undefined') {
            storage.set('adminConfig', JSON.stringify(main.config));
        }
    },
    showError:      function (error, cb) {
        main.showMessage(_(error),  _('Error'), 'alert', cb);
    },
    showMessage:    function (message, title, icon, cb) {
        if (typeof title === 'function') {
            cb = title;
            title = null;
            icon = null;
        }
        if (typeof icon === 'function') {
            cb = icon;
            icon = null;
        }
        $dialogMessage.dialog('option', 'title', title || _('Message'));
        $('#dialog-message-text').html(message);

        if (icon) {
            if (!icon.match(/^ui\-icon\-/)) icon = 'ui-icon-' + icon;

            $('#dialog-message-icon').show();
            $('#dialog-message-icon').attr('class', '');
            $('#dialog-message-icon').addClass('ui-icon ' + icon);
        } else {
            $('#dialog-message-icon').hide();
        }
        $dialogMessage.data('callback', cb);
        $dialogMessage.dialog('open');
    },
    confirmMessage: function (message, title, icon, buttons, callback) {
        if (typeof buttons === 'function') {
            callback = buttons;
            $dialogConfirm.dialog('option', 'buttons', [
                {
                    text: _('Ok'),
                    click: function () {
                        var cb = $(this).data('callback');
                        $(this).dialog('close');
                        if (cb) cb(true);
                    }
                },
                {
                    text: _('Cancel'),
                    click: function () {
                        var cb = $(this).data('callback');
                        $(this).dialog('close');
                        if (cb) cb(false);
                    }
                }

            ]);
        } else if (typeof buttons === 'object') {
            for (var b = 0; b < buttons.length; b++) {
                buttons[b] = {
                    text: buttons[b],
                    id: 'dialog-confirm-button-' + b,
                    click: function (e) {
                        var id = parseInt(e.currentTarget.id.substring('dialog-confirm-button-'.length), 10);
                        var cb = $(this).data('callback');
                        $(this).dialog('close');
                        if (cb) cb(id);
                    }
                }
            }
            $dialogConfirm.dialog('option', 'buttons', buttons);
        }

        $dialogConfirm.dialog('option', 'title', title || _('Message'));
        $('#dialog-confirm-text').html(message);
        if (icon) {
            $('#dialog-confirm-icon').show();
            $('#dialog-confirm-icon').attr('class', '');
            $('#dialog-confirm-icon').addClass('ui-icon ui-icon-' + icon);
        } else {
            $('#dialog-confirm-icon').hide();
        }
        $dialogConfirm.data('callback', callback);
        $dialogConfirm.dialog('open');
    },
    initSelectId:   function () {
        if (main.selectId) return main.selectId;
        main.selectId = $('#dialog-select-member').selectId('init',  {
            objects: main.objects,
            states:  main.states,
            noMultiselect: true,
            imgPath: '../../lib/css/fancytree/',
            filter: {type: 'state'},
            texts: {
                select:   _('Select'),
                cancel:   _('Cancel'),
                all:      _('All'),
                id:       _('ID'),
                name:     _('Name'),
                role:     _('Role'),
                room:     _('Room'),
                value:    _('Value'),
                selectid: _('Select ID'),
                from:     _('From'),
                lc:       _('Last changed'),
                ts:       _('Time stamp'),
                wait:     _('Processing...'),
                ack:      _('Acknowledged')
            },
            columns: ['image', 'name', 'role', 'room', 'value']
        });
        return main.selectId;
    },
    objects:        {},
    states:         {},
    currentHost:    '',
    instances:      [],
    objectsLoaded:  false,
    waitForRestart: false,
    selectId:       null
};

var $dialogMessage = $('#dialog-message');
var $dialogConfirm = $('#dialog-confirm');

// Read all positions, selected widgets for every view,
// Selected view, selected menu page,
// Selected widget or view page
// Selected filter
if (typeof storage !== 'undefined') {
    try {
        main.config = storage.get('adminConfig');
        if (main.config) {
            main.config = JSON.parse(main.config);
        } else {
            main.config = {};
        }
    } catch (e) {
        console.log('Cannot load edit config');
        main.config = {};
    }
}
var firstConnect = true;
var scripts  = new Scripts(main);

function getStates(callback) {
    main.socket.emit('getStates', function (err, res) {
        main.states = res;
        if (typeof callback === 'function') {
            setTimeout(function () {
                callback();
            }, 0);
        }
    });
}

function getObjects(callback) {
    main.socket.emit('getObjects', function (err, res) {
        setTimeout(function () {
            var obj;
            main.objects = res;
            for (var id in main.objects) {
                if (id.slice(0, 7) === '_design') continue;

                obj = res[id];
                if (obj.type === 'instance') main.instances.push(id);
                if (obj.type === 'script')   scripts.list.push(id);
                if (obj.type === 'channel' && id.match(/^script\.js\./)) scripts.groups.push(id);
                if (obj.type === 'host') scripts.hosts.push(id);
            }
            main.objectsLoaded = true;

            scripts.prepare();
            scripts.init();

            if (typeof callback === 'function') callback();
        }, 0);
    });
}

function objectChange(id, obj) {
    // update main.objects cache
    if (obj) {
        if (obj._rev && main.objects[id]) main.objects[id]._rev = obj._rev;
        if (!main.objects[id] || JSON.stringify(main.objects[id]) != JSON.stringify(obj)) {
            main.objects[id] = obj;
        }
    } else if (main.objects[id]) {
        var oldObj = {_id: id, type: main.objects[id].type};
        delete main.objects[id];
        if (oldObj.type === 'instance') {
            var pos = main.instances.indexOf(id);
            if (pos !== -1) main.instances.splice(pos, 1);
        } else
        if (oldObj.type === 'script') {
            var pos = main.instances.indexOf(id);
            if (pos !== -1) main.instances.splice(pos, 1);
        } else
        if (id.match(/^script\.js\./) && oldObj.type === 'channel') {
            var pos = main.instances.indexOf(id);
            if (pos !== -1) main.instances.splice(pos, 1);
        }
    }

    if (main.selectId) main.selectId.selectId('object', id, obj);

    if (id.match(/^system\.adapter\.[-\w]+\.[0-9]+$/)) {
        // Disable scripts tab if no one script engine instance found
        var engines = scripts.fillEngines();
        $('#tabs').tabs('option', 'disabled', (engines && engines.length) ? [] : [4]);
    }

    scripts.objectChange(id, obj);
}

function stateChange(id, state) {
    var rowData;
    id = id ? id.replace(/[\s'"]/g, '_') : '';

    if (!id || !id.match(/\.messagebox$/)) {
        if (main.selectId) main.selectId.selectId('state', id, state);
    }
}

function onLog(message) {
    scripts.onLog(message);
}
main.socket.on('permissionError', function (err) {
    main.showMessage(_('Has no permission to %s %s %s', err.operation, err.type, (err.id || '')));
});
main.socket.on('objectChange', function (id, obj) {
    setTimeout(objectChange, 0, id, obj);
});
main.socket.on('stateChange', function (id, obj) {
    setTimeout(stateChange, 0, id, obj);
});
main.socket.on('connect', function () {
    $('#connecting').hide();
    if (firstConnect) {
        firstConnect = false;

        main.socket.emit('getUserPermissions', function (err, acl) {
            main.acl = acl;
            // Read system configuration
            main.socket.emit('getObject', 'system.config', function (err, data) {
                main.systemConfig = data;
                if (!err && main.systemConfig && main.systemConfig.common) {
                    systemLang = main.systemConfig.common.language;
                } else {
                    systemLang = window.navigator.userLanguage || window.navigator.language;

                    if (systemLang !== 'en' && systemLang !== 'de' && systemLang !== 'ru') {
                        main.systemConfig.common.language = 'en';
                        systemLang = 'en';
                    }
                }

                translateAll();

                $dialogMessage.dialog({
                    autoOpen: false,
                    modal:    true,
                    buttons: [
                        {
                            text: _('Ok'),
                            click: function () {
                                $(this).dialog('close');
                                var cb = $(this).data('callback');
                                if (typeof cb === 'function') {
                                    $(this).data('callback', null);
                                    cb();
                                }
                            }
                        }
                    ]
                });

                $dialogConfirm.dialog({
                    autoOpen: false,
                    modal:    true,
                    width:    400,
                    height:   200,
                    buttons: [
                        {
                            text: _('Ok'),
                            click: function () {
                                var cb = $(this).data('callback');
                                $(this).dialog('close');
                                if (cb) cb(true);
                            }
                        },
                        {
                            text: _('Cancel'),
                            click: function () {
                                var cb = $(this).data('callback');
                                $(this).dialog('close');
                                if (cb) cb(false);
                            }
                        }

                    ]
                });

                getStates(getObjects);
            });
        });
    }
    if (main.waitForRestart) {
        location.reload();
    }
});
main.socket.on('disconnect', function () {
    $('#connecting').show();
});
main.socket.on('reconnect', function () {
    $('#connecting').hide();
    if (main.waitForRestart) {
        location.reload();
    }
});
main.socket.on('reauthenticate', function () {
    location.reload();
});
main.socket.on('log', function (message) {
    setTimeout(onLog, 0, message);
});

function applyResizableH(install, timeout) {
    if (timeout) {
        setTimeout(function () {
            applyResizableH(install);
        }, timeout);
    } else {
        if ($('#grid-scripts').hasClass('ui-resizable')) $('#grid-scripts').resizable('destroy');

        if (!install) return;

        var width = parseInt(main.config['script-editor-width'] || '30%', 10);

        $('#grid-scripts').width(width + '%').next().width(100 - width + '%');

        $('#grid-scripts').resizable({
            autoHide:   false,
            handles:    'e',
            start:      function (e, ui) {
                $('#blockly-editor').data('wasVisible', $('#blockly-editor').is(':visible'));
                $('#blockly-editor').hide();
                $('.blocklyWidgetDiv').hide();
                $('.blocklyTooltipDiv').hide();
                $('.blocklyToolboxDiv').hide();
            },
            resize:     function(e, ui) {
                var parent = ui.element.parent();
                var remainingSpace = parent.width() - ui.element.outerWidth();
                var divTwo = ui.element.next();
                var divTwoWidth = (remainingSpace - (divTwo.outerWidth() - divTwo.width())) / parent.width() * 100 + '%';
                divTwo.width(divTwoWidth);
            },
            stop: function(e, ui) {
                var parent = ui.element.parent();
                var width  = ui.element.width() / parent.width() * 100 + '%';
                ui.element.css({
                    width: width
                });
                main.saveConfig('script-editor-width', width);
                scripts.resize();
            }
        });
    }
}

function applyResizableV() {
    var height = parseInt(main.config['script-editor-height'] || '80%', 10);
    $('#editor-scripts-textarea').height(height + '%').next().height(100 - height + '%');

    $('#editor-scripts-textarea').resizable({
        autoHide:   false,
        handles:    's',
        start:      function (e, ui) {
            $('#blockly-editor').data('wasVisible', $('#blockly-editor').is(':visible'));
            $('#blockly-editor').hide();
            $('.blocklyWidgetDiv').hide();
            $('.blocklyTooltipDiv').hide();
            $('.blocklyToolboxDiv').hide();
        },
        resize:     function (e, ui) {
            var parent = ui.element.parent();
            var remainingSpace = parent.height() - ui.element.outerHeight();
            var divTwo = ui.element.next();
            var divTwoWidth = (remainingSpace - (divTwo.outerHeight() - divTwo.height())) / parent.height() * 100 + '%';
            divTwo.height(divTwoWidth);
        },
        stop: function (e, ui) {
            var parent = ui.element.parent();
            var height = ui.element.height() / parent.height() * 100 + '%';
            ui.element.css({
                height: height
            });
            main.saveConfig('script-editor-height', height);

            scripts.resize();
        }
    });
}

window.onbeforeunload = function(evt) {
    if (scripts.changed) {
        if (window.confirm(_('Script changes are not saved. Discard?'))) {
            return null;
        } else {
            return _('Configuration not saved.');
        }
    }
    return null;
};