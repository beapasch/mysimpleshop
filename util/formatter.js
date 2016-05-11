jQuery.sap.declare("nw.epm.refapps.ext.shop.util.formatter");

nw.epm.refapps.ext.shop.util.formatter = {};

/**
 * Formatter for Reviewer Name - Returns Me for own review or user name for other reviews
 * 
 * @param {boolean}
 *            bIsReviewOfCurrentUser Indicates whether or not the review was created by the current user
 * @param {string}
 *            sUserName Name of the current user
 * @returns {string} Me if the review was created by the current user, otherwise the user name
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.formatMyReview = function(bIsReviewOfCurrentUser, sUserName) {
    return (bIsReviewOfCurrentUser) ? this.getModel("i18n").getResourceBundle().getText("xfld.me") : sUserName;
};

/**
 * Formatter for Helpful link - Returns concatenated string with Text and Helpful Count
 * 
 * @param {int}
 *            iHelpfulCount The number of helpful ratings
 * @returns {string} Helpful text and count
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.formatHelpfulCount = function(iHelpfulCount) {
    return this.getModel().getProperty("/#Review/HelpfulForCurrentUser/@sap:label") + " (" + iHelpfulCount + ")";
};

/**
 * Formatter that negates a boolean value
 * 
 * @param {boolean}
 *            bValue A boolean value
 * @returns {boolean} The negation of the input parameter
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.negateBoolean = function(bValue) {
    return !bValue;
};

/**
 * Formatter converts an integer to a string
 * 
 * @param {int}
 *            iValue An integer value
 * @returns {string} The imported integer as a string
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.intToString = function(iValue) {
    return iValue.toString();
};

/**
 * Formatter for Availability - Displays text or text + number
 * 
 * @param {integer}
 *            iAvailability The number of products on stock
 * @returns {string} A textual representation of the availability
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.formatAvailabilityText = function(iAvailability) {
    var oResourceBundle = this.getModel("i18n").getResourceBundle();
    if (isNaN(iAvailability) || iAvailability < 1) {
        return oResourceBundle.getText("xfld.outOfStock");
    }
    if (iAvailability < 10) {
        return oResourceBundle.getText("xfld.inStockLeft", [ iAvailability ]);
    }
    return oResourceBundle.getText("xfld.inStock");
};

/**
 * Formatter for Availability - Displays text in red (error) or green (success)
 * 
 * @param {integer}
 *            iAvailability The number of products on stock
 * @returns {state} sap.ui.core.ValueState A color representation of the
 *          availability
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.formatAvailabilityStatus = function(iAvailability) {
    return (isNaN(iAvailability) || Number(iAvailability) < 1) ? sap.ui.core.ValueState.Error
            : sap.ui.core.ValueState.Success;
};

/**
 * Formatter for Measures - Returns concatenated string with measure and unit
 * 
 * @param {float}
 *            fMeasure A measure
 * @param {string}
 *            sUnit A unit
 * @returns {string} A combined textual representation of measure and unit
 * @public
 */
nw.epm.refapps.ext.shop.util.formatter.formatMeasure = function(fMeasure, sUnit) {
    jQuery.sap.require("sap.ca.ui.model.format.QuantityFormat");
    return (isNaN(fMeasure) || fMeasure === "" || fMeasure === null) ? "" : sap.ca.ui.model.format.QuantityFormat
            .FormatQuantityStandard(fMeasure, sUnit) + " " + sUnit;
};