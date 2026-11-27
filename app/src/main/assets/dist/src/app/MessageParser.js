/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
    Reads a message to the engine as tokens split on single spaces: the command first, then its
    parameters, each a name and a value joined by an equals sign. A key message ends with a line
    break, which is kept apart from the tokens.
*/
class MessageParser {
    constructor(message) {
        const body = message.trimEnd();
        this.tokens = body.split(' ');
        this.tail = message.substring(body.length);
    }
    /// The first token.
    get command() {
        return this.tokens[0];
    }
    /// How many tokens there are, the command included.
    get length() {
        return this.tokens.length;
    }
    /// The value of the named parameter, or undefined where there is none.
    value(name) {
        const at = this.indexOf(name);
        return at < 0 ? undefined : this.tokens[at].substring(name.length + 1);
    }
    /// The value of the named parameter as a non-negative integer, or undefined where it is
    /// not one.
    count(name) {
        const text = this.value(name);
        const number = Number(text);
        return text && Number.isInteger(number) && number >= 0 ? number : undefined;
    }
    /// The sequence number of an input message, or undefined where there is none.
    get sequence() {
        return this.count('sequence');
    }
    /// The message with the named parameter set to the value, added at the end where there
    /// was none.
    with(name, value) {
        const token = name + '=' + value;
        const at = this.indexOf(name);
        const tokens = this.tokens.slice();
        if (at < 0)
            tokens.push(token);
        else
            tokens[at] = token;
        return this.joined(tokens);
    }
    /// The message without the named parameter, or as it is where there is none.
    without(name) {
        const at = this.indexOf(name);
        if (at < 0)
            return this.joined(this.tokens);
        const tokens = this.tokens.slice();
        tokens.splice(at, 1);
        return this.joined(tokens);
    }
    /// The message made of those tokens, with the tail the parsed message had after them.
    joined(tokens) {
        return tokens.join(' ') + this.tail;
    }
    indexOf(name) {
        return this.tokens.findIndex((one) => one.startsWith(name + '='));
    }
}
