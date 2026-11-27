/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
var cool;
(function (cool) {
    /**
     * Provides a dialog to select an electronic signing provider.
     */
    class ESignatureDialog {
        constructor(countries, providers) {
            this.id = 'ESignatureDialog';
            this.defaultCountryCode = '';
            this.defaultProviderId = '';
            // Providers available in the selected country
            this.filteredProviders = [];
            // Sort the lists based on the UI name.
            this.availableCountries = countries;
            this.availableCountries.sort((a, b) => a.name.localeCompare(b.name));
            this.availableProviders = providers;
            this.availableProviders.sort((a, b) => a.name.localeCompare(b.name));
        }
        // Produces the JSDialog JSON for the provider listbox
        getProviderLbJSON(providers, defaultProviderIndex) {
            return {
                id: 'providerlb',
                type: 'listbox',
                enabled: true,
                children: [
                    {
                        id: '',
                        type: 'control',
                        enabled: true,
                        children: [],
                    },
                    {
                        type: 'pushbutton',
                        enabled: true,
                        symbol: 'SPIN_DOWN',
                    },
                ],
                labelledBy: 'providerft',
                entries: providers,
                selectedCount: 1,
                selectedEntries: [String(defaultProviderIndex)],
            };
        }
        getChildrenJSON(countries, defaultCountryIndex, providers, defaultProviderIndex) {
            return [
                {
                    id: 'countryft',
                    type: 'fixedtext',
                    text: _('Country:'),
                    enabled: true,
                    labelFor: 'countrylb',
                },
                {
                    id: 'countrylb',
                    type: 'listbox',
                    enabled: true,
                    children: [
                        {
                            id: '',
                            type: 'control',
                            enabled: true,
                            children: [],
                        },
                        {
                            type: 'pushbutton',
                            enabled: true,
                            symbol: 'SPIN_DOWN',
                        },
                    ],
                    labelledBy: 'countryft',
                    entries: countries,
                    selectedCount: 1,
                    selectedEntries: [String(defaultCountryIndex)],
                },
                {
                    id: 'providerft',
                    type: 'fixedtext',
                    text: _('Provider:'),
                    enabled: true,
                    labelFor: 'providerlb',
                },
                this.getProviderLbJSON(providers, defaultProviderIndex),
                {
                    id: this.id + '-buttonbox',
                    type: 'buttonbox',
                    children: [
                        {
                            id: 'ok',
                            type: 'pushbutton',
                            text: _('OK'),
                        },
                    ],
                    layoutstyle: 'end',
                },
            ];
        }
        // Updates the filtered provider list based on a country code and gets a default
        // provider index.
        getDefaultProviderIndex() {
            this.filteredProviders = this.availableProviders.filter((provider) => provider.countryCodes.includes(this.defaultCountryCode));
            let defaultProviderIndex = this.filteredProviders
                .map((entry) => entry.action_type)
                .indexOf(this.defaultProviderId);
            if (defaultProviderIndex == -1) {
                defaultProviderIndex = 0;
            }
            return defaultProviderIndex;
        }
        getJSON() {
            const countries = this.availableCountries.map((entry) => entry.name);
            let defaultCountryIndex = this.availableCountries
                .map((entry) => entry.code)
                .indexOf(this.defaultCountryCode);
            if (defaultCountryIndex == -1) {
                defaultCountryIndex = 0;
            }
            const defaultProviderIndex = this.getDefaultProviderIndex();
            const providers = this.filteredProviders.map((entry) => entry.name);
            const children = this.getChildrenJSON(countries, defaultCountryIndex, providers, defaultProviderIndex);
            return {
                id: this.id,
                dialogid: this.id,
                type: 'dialog',
                text: _('Insert Electronic Signature'),
                title: _('Insert Electronic Signature'),
                jsontype: 'dialog',
                responses: [
                    {
                        id: 'ok',
                        response: 1,
                    },
                ],
                children: [
                    {
                        id: this.id + '-mainbox',
                        type: 'container',
                        vertical: true,
                        children: children,
                    },
                ],
            };
        }
        close() {
            const closeEvent = {
                data: {
                    action: 'close',
                    id: this.id,
                },
            };
            app.map.fire('jsdialog', closeEvent);
        }
        callback(objectType, eventType, object, data, builder) {
            if (eventType === 'response' || object.id === 'ok') {
                const providers = (document.querySelector('#ESignatureDialog select#providerlb-input'));
                const providerId = this.filteredProviders[providers.selectedIndex].action_type;
                const countries = (document.querySelector('#ESignatureDialog select#countrylb-input'));
                const countryCode = this.availableCountries[countries.selectedIndex].code;
                this.close();
                Util.ensureValue(app.map.eSignature);
                app.map.eSignature.handleSelectedProvider(countryCode, providerId);
            }
            else if (eventType === 'selected' && object.id === 'countrylb') {
                // The selected country changed, update the list of providers
                // accordingly
                // Index-label pair
                const countryIndex = parseInt(data.split(';')[0]);
                this.defaultCountryCode = this.availableCountries[countryIndex].code;
                const defaultProviderIndex = this.getDefaultProviderIndex();
                const providers = this.filteredProviders.map((entry) => entry.name);
                const providerLbJSON = this.getProviderLbJSON(providers, defaultProviderIndex);
                app.map.fire('jsdialogupdate', {
                    data: {
                        jsontype: 'dialog',
                        action: 'update',
                        id: 'ESignatureDialog',
                        control: providerLbJSON,
                    },
                    callback: this.callback.bind(this),
                });
            }
        }
        open() {
            const dialogBuildEvent = {
                data: this.getJSON(),
                callback: this.callback.bind(this),
            };
            app.map.fire('jsdialog', dialogBuildEvent);
        }
        setDefaultCountryCode(countryCode) {
            this.defaultCountryCode = countryCode;
        }
        setDefaultProviderId(providerId) {
            this.defaultProviderId = providerId;
        }
    }
    cool.ESignatureDialog = ESignatureDialog;
})(cool || (cool = {}));
JSDialog.eSignatureDialog = (countries, providers) => {
    return new cool.ESignatureDialog(countries, providers);
};
