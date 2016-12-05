import React from "react";
import MDL from './MdlComponents';
import Xterm from "xterm";
import "xterm/addons/fit/fit";
import $ from "jquery";
import Base64Tool from "js-base64";
import Cookie from '../models/Cookie';
import {ACCESS_TOKEN_COOKIE} from '../models/apis/Types';

// The following constants must be equals with
// https://github.com/laincloud/entry/blob/master/message.proto
const REQUEST_PLAIN = 0;
const REQUEST_WINCH = 1;
const RESPONSE_PING = 3;

var printWarn = function(data) {
    return `\x1B[33m${data}\x1B[0m`;
};
var printErr = function(data) {
    return `\x1B[31m${data}\x1B[0m`;
};

let TerminalCard = React.createClass({

    contextTypes: {
        theme: React.PropTypes.object,
    },

    componentDidMount(){
        this.initTerminal();
    },

    render() {
        const {theme} = this.context;
        return (
            <MDL.Card depth={2} style={theme.card}>
                <MDL.CardTitle title="容器终端" style={_.assign({}, this.styles.cardTitle, theme.colorStyle('proc', true))} />
                <div style={{ padding: 16 }} id="container_terminal">
                </div>
            </MDL.Card>
        );
    },
    styles: {
        cardTitle: {
            height: 56,
            color: 'white',
        },
    },

    initTerminal() {
        var term = new Xterm({
            cursorBlink: true,
            rows: 40,
        });
        term.open($('#container_terminal')[0]);
        term.fit();
        var termSize = term.proposeGeometry();
        term.writeln(printWarn(">>> This terminal is based on xterm.js (https://github.com/sourcelair/xterm.js)"));
        term.writeln(printWarn(`>>> Trying to connect container [${this.props.procName}-${this.props.instanceNo}] of ${this.props.appName}...`));
        var auth = {
            "app_name": this.props.appName,
            "proc_name": this.props.procName,
            "instance_no": this.props.instanceNo,
            "access_token": Cookie.get(ACCESS_TOKEN_COOKIE),
        };
        var ws = new WebSocket(`${window.assets.entryServer}/enter?method=web`);
        ws.onopen = function() {
            term.writeln(printWarn(">>> Connection established. Waiting for authorization and authentication..."))
            ws.send(JSON.stringify(auth));
            var msg = {
                "msgType": REQUEST_WINCH,
                "content": Base64Tool.Base64.encode(termSize.cols + " " + termSize.rows),
            };
            ws.send(JSON.stringify(msg));
        };

        ws.onerror = function() {
            term.writeln(printErr(">>> Server stops the connection. Ask admin for help."));
        };

        ws.onmessage = function(message) {
            var reader = new FileReader();
            reader.addEventListener("loadend", function() {
                var dec = new TextDecoder("utf-8");
                var cont = JSON.parse(dec.decode(reader.result));
                if (cont.msgType != RESPONSE_PING) {
                    term.write(Base64Tool.Base64.decode(cont.content));
                }
            });
            reader.readAsArrayBuffer(message.data);
        };

        term.on("data", function(data) {
            var msg = {
                "msgType": REQUEST_PLAIN,
                "content": Base64Tool.Base64.encode(data),
            };
            ws.send(JSON.stringify(msg));
        });

        term.on("resize", function(data) {
            try {
                var msg = {
                    "msgType": REQUEST_WINCH,
                    "content": Base64Tool.Base64.encode(data.cols + " " + data.rows),
                };
                ws.send(JSON.stringify(msg));
            } catch (ex) {
            }
        });

        term.attachCustomKeydownHandler(function (e) {
            if (e.keyCode == 27) {
                term.focus();
            }
            return true;
        });

        $(window).on("resize", function(){
            term.fit();
        });

    },
});

export default TerminalCard;