/* -*- js-indent-level: 8 -*- */
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
 * The structure of a text. Each of these groups part of a text, and its children are everything
 * it draws.
 */
var cool;
(function (cool) {
    let TextHierarchyFieldPrimitive;
    (function (TextHierarchyFieldPrimitive) {
        TextHierarchyFieldPrimitive.type = 'textHierarchyField';
    })(TextHierarchyFieldPrimitive = cool.TextHierarchyFieldPrimitive || (cool.TextHierarchyFieldPrimitive = {}));
    let TextHierarchyLinePrimitive;
    (function (TextHierarchyLinePrimitive) {
        TextHierarchyLinePrimitive.type = 'textHierarchyLine';
    })(TextHierarchyLinePrimitive = cool.TextHierarchyLinePrimitive || (cool.TextHierarchyLinePrimitive = {}));
    let TextHierarchyParagraphPrimitive;
    (function (TextHierarchyParagraphPrimitive) {
        TextHierarchyParagraphPrimitive.type = 'textHierarchyParagraph';
        /// The paragraph nodes of the object's own text, in text order, or an
        /// empty list. The copy in a shadow, hidden geometry and edit-view
        /// content are passed over.
        function collect(primitives) {
            const block = findBlock(primitives);
            if (!block?.children)
                return [];
            return block.children.filter((child) => child.type === TextHierarchyParagraphPrimitive.type);
        }
        TextHierarchyParagraphPrimitive.collect = collect;
        function findBlock(primitives) {
            if (!primitives)
                return undefined;
            for (const primitive of primitives) {
                if (primitive.type === TextHierarchyBlockPrimitive.type)
                    return primitive;
                if (primitive.type === cool.ShadowPrimitive.type ||
                    primitive.type === cool.HiddenGeometryPrimitive.type ||
                    primitive.type === cool.ExclusiveEditViewPrimitive.type)
                    continue;
                const found = findBlock(primitive.children);
                if (found)
                    return found;
            }
            return undefined;
        }
    })(TextHierarchyParagraphPrimitive = cool.TextHierarchyParagraphPrimitive || (cool.TextHierarchyParagraphPrimitive = {}));
    let TextHierarchyBlockPrimitive;
    (function (TextHierarchyBlockPrimitive) {
        TextHierarchyBlockPrimitive.type = 'textHierarchyBlock';
    })(TextHierarchyBlockPrimitive = cool.TextHierarchyBlockPrimitive || (cool.TextHierarchyBlockPrimitive = {}));
    let TextHierarchyBulletPrimitive;
    (function (TextHierarchyBulletPrimitive) {
        TextHierarchyBulletPrimitive.type = 'textHierarchyBullet';
    })(TextHierarchyBulletPrimitive = cool.TextHierarchyBulletPrimitive || (cool.TextHierarchyBulletPrimitive = {}));
    let TextHierarchyEmphasisMarkPrimitive;
    (function (TextHierarchyEmphasisMarkPrimitive) {
        TextHierarchyEmphasisMarkPrimitive.type = 'textHierarchyEmphasisMark';
    })(TextHierarchyEmphasisMarkPrimitive = cool.TextHierarchyEmphasisMarkPrimitive || (cool.TextHierarchyEmphasisMarkPrimitive = {}));
})(cool || (cool = {}));
