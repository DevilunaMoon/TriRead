// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
/*
 * The cloud services the backstage Add-account dialog offers, and the
 * name and icon each one is drawn with.
 */
var BackstageCloudKinds;
(function (BackstageCloudKinds) {
    // A kind ends up inside a CSS class name and inside a stored account id, so it holds
    // lower-case letters, digits and dashes, and starts with a letter or a digit.
    const kindPattern = /^[a-z0-9][a-z0-9-]*$/;
    // Any server that speaks the protocol, whichever product runs it.
    const otherKind = 'other';
    // The services this build ships with. A branding offers its own instead.
    const shippedKinds = [
        { kind: 'nextcloud', label: 'Nextcloud', isBrand: false },
        { kind: 'opencloud', label: 'OpenCloud', isBrand: false },
        { kind: 'seafile', label: 'Seafile', isBrand: false },
    ];
    function isValidKind(kind) {
        return typeof kind === 'string' && kindPattern.test(kind);
    }
    BackstageCloudKinds.isValidKind = isValidKind;
    // The services on offer, in the order they are listed to the user. A branding that declares
    // a list is taken at its word, even when nothing in that list is usable: the shipped
    // services appear only where no branding declared a list at all. Other comes last, and
    // exactly once: a branding that names it as well gets the translated entry, not two rows.
    function list() {
        const branded = brandedKinds();
        const offered = branded !== undefined ? branded : shippedKinds;
        return offered.concat([
            { kind: otherKind, label: _('Other'), isBrand: false },
        ]);
    }
    BackstageCloudKinds.list = list;
    // The service an account is drawn as. An account stored while another branding was in
    // place names a service that is no longer on offer, and is drawn as Other.
    function offeredKind(kind) {
        return find(kind) ? kind : otherKind;
    }
    BackstageCloudKinds.offeredKind = offeredKind;
    // The kind the Add-account dialog starts on.
    function defaultKind() {
        return list()[0].kind;
    }
    BackstageCloudKinds.defaultKind = defaultKind;
    // The name of a service. An account stored while another branding was in place names a
    // service that is no longer on offer, and reads as Other.
    function label(kind) {
        const entry = find(kind);
        return entry ? entry.label : _('Other');
    }
    BackstageCloudKinds.label = label;
    // The classes that draw a service's icon. The bare class alone draws the generic cloud, which
    // is what a service that is no longer on offer gets. A per-service class always carries the
    // backstage-cloud-icon- prefix, so it stays apart from the branded marker whatever the
    // service is called.
    function iconClasses(kind) {
        const entry = find(kind);
        const classes = ['backstage-cloud-icon'];
        if (entry) {
            classes.push('backstage-cloud-icon-' + entry.kind);
            if (entry.isBrand)
                classes.push('backstage-cloud-brand-icon');
        }
        return classes.join(' ');
    }
    BackstageCloudKinds.iconClasses = iconClasses;
    function find(kind) {
        return list().find((entry) => entry.kind === kind);
    }
    // The services a branding declares, or undefined where no branding declared a list. An
    // empty result means a branding declared a list that named no usable service.
    function brandedKinds() {
        const declared = typeof brandCloudProviders !== 'undefined'
            ? brandCloudProviders
            : undefined;
        if (!Array.isArray(declared))
            return undefined;
        const entries = [];
        declared.forEach((provider) => {
            if (!provider || !isValidKind(provider.kind))
                return;
            if (provider.kind === otherKind)
                return;
            const named = typeof provider.label === 'string' && provider.label.length > 0;
            entries.push({
                kind: provider.kind,
                label: named ? provider.label : provider.kind,
                isBrand: true,
            });
        });
        return entries;
    }
})(BackstageCloudKinds || (BackstageCloudKinds = {}));
