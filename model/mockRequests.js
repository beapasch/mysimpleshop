jQuery.sap.declare("webide.mock.ext.mockRequests");
// In mock mode, the mock server intercepts HTTP calls and provides fake output to the
// client without involving a backend system. But special backend logic, such as that 
// performed by function imports, is not automatically known to the mock server. To handle
// such cases, the app needs to define specific mock requests that simulate the backend 
// logic using standard HTTP requests (that are again interpreted by the mock server) as 
// shown below. 

// Please note:
// The usage of synchronous calls is only allowed in this context because the requests are
// handled by a latency-free client-side mock server. In production coding, asynchronous
// calls are mandatory.

// The mock requests object caontains three attributes. 
// method -     This is the http method (e.g. POST, PUT, DELETE,...) to which the mock request refers.
//              It is one of two criterions used by the mock server to decide if a request is handled
//              by a certain mock request object.
// path -       This is a regular expression that is matched against the url of the current request. 
//              It is the second criterion used by the mock server to decide if a request is handled
//              by a certain mock request object. Please note that using the (.*) for the url parameter
//              section in the pattern causes the mock server to extract the url parameters from the
//              URL and provide them as separate import parameters to the handler function.
// response -   This is the handler function that is called when a http request matches the "method" 
//              and "path" attributes of the mock request. A XML http request object (oXhr) for the
//              matched request is provided as an import parameter and optionally there can be import 
//              parameters for url parameters
//              Please note that handler function needs to create the same response object as the 
//              life service would.

webide.mock.ext.mockRequests = {
	_srvUrl: "/sap/opu/odata/sap/EPM_REF_APPS_SHOP_SRV/", //service url
	_bError: false, //true if a this._sjax request failed
	_sErrorTxt: "", //error text for the oXhr error response

	getRequests: function() {
		// This method is called by the webIDE if the app is started in mock mode with the 
		// option "AddCustom Mock Requests". It returns the list of app specific mock requests.
		// The list is added to the mock server's own list of requests
		return [
		    this._mockAddProductToShoppingCart(),
            this._mockBuyShoppingCart(),
            this._mockDeleteItem(),
            this._mockRateAsHelpful(),
            this._mockWriteAReview(),
            this._mockChangeItemQuantity(),
            this._mockDeleteAReview(),
            this._mockChangeAReview()
            ];
	},

	_mockDeleteItem: function() {
		// This mock request updates the totals on the shopping cart when a
		// shopping cart item is deleted. This
		// is necessary because the the calculation of the totals and the update
		// of the shopping cart is not
		// directly triggered by a http request. Instead the back end does it
		// automatically during the
		// processing of a http delete request for a shopping cart item
		var oMockRequest = this._calcCartTotalsFromItems();
		oMockRequest.method = "DELETE";
		return oMockRequest;
	},

	_mockAddProductToShoppingCart: function() {
		return {
			// This mock request handles the "AddProductToShoppingCart" function
			// The following steps are performed:
			// - Create a shopping cart for the user if none exists yet. This is
			// not done here because the built-in mock data already contains a 
			// shopping cart.
			// - Update the total quantity property of the shopping cart
			// - Create a new shopping cart item if there is no item yet that
			// contains the added product. If such an
			// item already exists, update its quantity and value accordingly.
			method: "POST",
			path: new RegExp("AddProductToShoppingCart\\?ProductId=(.*)"),
			response: jQuery.proxy(function(oXhr, sUrlProductId) {
					var aItemIds = [],
						oResponseGetTotalQuantity = null,
						oResponseGetProduct = null,
						oResponseGetShoppingCartItems = null,
						oMatchingItem = null,
						oProduct = null,
						oShoppingCart = null,
						oNewItemData = {},
						sProductId = decodeURIComponent(sUrlProductId);
					sProductId = sProductId.substring(1, sProductId.length - 1);
					this._resetErrorIndicator();
					// get total quantity of shopping cart items
					oResponseGetTotalQuantity = this._sjax({
						url: "ShoppingCarts(-1)",
						errorText: "Error: Mocking function import AddProductToShoppingCart failed"
					});

					if (!this._bError) {
						oShoppingCart = oResponseGetTotalQuantity.data.d;
						// get the product details
						oResponseGetProduct = this._sjax({
							url: "Products('" + sProductId + "')",
							errorText: "Error: Mocking function import AddProductToShoppingCart failed"
						});
					}

					if (!this._bError) {
						oProduct = oResponseGetProduct.data.d;
						// Get shopping cart items
						oResponseGetShoppingCartItems = this._sjax({
							url: "ShoppingCarts(-1)/ShoppingCartItems",
							errorText: "Error: Mocking function import AddProductToShoppingCart failed"
						});
					}

					if (!this._bError) {
						// check whether or not there is an item for the current
						// product and collect the Ids of the existing items if a new
						// item needs to be created we need to make sure that it gets a
						// new Id
						for (var i = 0; i < oResponseGetShoppingCartItems.data.d.results.length && !oMatchingItem; i++) {
							if (oResponseGetShoppingCartItems.data.d.results[i].ProductId === sProductId) {
								oMatchingItem = oResponseGetShoppingCartItems.data.d.results[i];
								aItemIds.length = 0;
							} else {
								aItemIds.push(oResponseGetShoppingCartItems.data.d.results[i].Id);
							}
						}

						// Create a new shopping cart item or update an existing one
						if (oMatchingItem) {
							// There is already an item for this product -> just update the
							// quantity and value
							oNewItemData = {
								Id: oMatchingItem.Id,
								ProductId: oMatchingItem.ProductId,
								CurrencyCode: oMatchingItem.CurrencyCode,
								Quantity: +oMatchingItem.Quantity + 1,
								ShoppingCartId: oMatchingItem.ShoppingCartId,
								SubTotal: +oMatchingItem.SubTotal + +oProduct.Price,
								Unit: oMatchingItem.Unit
							};

							this._sjax({
								url: "ShoppingCartItems('" + oMatchingItem.Id + "')",
								type: "PUT",
								data: oNewItemData,
								errorText: "Error: Mocking function import AddProductToShoppingCart failed"
							});

						} else {
							// create a new item for this product
							oNewItemData = {
								Id: this._getNewId(aItemIds),
								ProductId: oProduct.Id,
								CurrencyCode: oProduct.CurrencyCode,
								Quantity: 1,
								ShoppingCartId: -1,
								SubTotal: oProduct.Price,
								Unit: oProduct.QuantityUnit
							};

							this._sjax({
								url: "ShoppingCartItems('" + oNewItemData.Id + "')",
								type: "POST",
								data: oNewItemData,
								errorText: "Error: Mocking function import AddProductToShoppingCart failed"
							});
						}
					}
					// Update the new total quantity and total value on the shopping
					// cart
					if (!this._bError) {
						oShoppingCart.TotalQuantity = +oShoppingCart.TotalQuantity + 1;
						oShoppingCart.Total = +oShoppingCart.Total + +oProduct.Price;
						oResponseGetTotalQuantity = this._sjax({
							url: "ShoppingCarts(-1)",
							type: "PUT",
							data: oShoppingCart,
							errorText: "Error: Could not update shopping cart mock data"
						});
					}
					if (this._bError) {
						oXhr.respond(400, null, this.sErrorTxt);
					} else {
						oXhr.respondJSON(200, {}, JSON.stringify({
							d: {
								ProductId: sProductId
							}
						}));
					}
				},
				this)
		};
	},

	_mockBuyShoppingCart: function() {
		return {
			// This mock request simulates the function import "BuyShoppingCart",
			// which is triggered when the "Buy Now" button is chosen on the
			// Checkout view.
			// It removes all items from the shopping cart and sets the totals on
			// the shopping cart to 0.		    
			method: "POST",
			path: new RegExp("BuyShoppingCart"),
			response: jQuery.proxy(function(oXhr) {
				var oResponseGetShoppingCartItems = null,
					oResponseGetShoppingCart = null,
					oNewShoppingCartData = null,
					i;
				this._resetErrorIndicator();
				// Get shopping cart
				oResponseGetShoppingCart = this._sjax({
					url: "ShoppingCarts(-1)",
					errorText: "Error: shopping cart could not be read from mock data"
				});

				if (!this._bError) {
					oNewShoppingCartData = oResponseGetShoppingCart.data.d;
					oNewShoppingCartData.Total = "0";
					oNewShoppingCartData.TotalQuantity = "0";
					this._sjax({
						url: "ShoppingCarts(-1)",
						type: "PUT",
						data: oNewShoppingCartData,
						errorText: "Error: Could not update shopping cart mock data"
					});
				}

				if (!this._bError) {
					// Get all shopping cart items (the ID is needed to delete them
					// later on) Get shopping cart items
					oResponseGetShoppingCartItems = this._sjax({
						url: "ShoppingCarts(-1)/ShoppingCartItems",
						errortext: "Error: shopping cart items could not be read from mock data"
					});
				}

				if (!this._bError) {
					// Delete the shopping cart items from the shopping cart.

					for (i = 0; i < oResponseGetShoppingCartItems.data.d.results.length; i++) {
						this._sjax({
							url: "ShoppingCartItems('" + oResponseGetShoppingCartItems.data.d.results[i].Id + "')",
							type: "DELETE",
							errorText: "Error: shopping cart items could not be removed from mock data"
						});
					}
				}
				if (!this._bError) {
					oXhr.respondJSON(200, {}, JSON.stringify({
						d: {
							results: []
						}
					}));
				} else {
					oXhr.respond(400, null, this._sErrorTxt);
				}
			}, this)
		};
	},

	_mockChangeItemQuantity: function() {
		// This mock request updates the totals on the shopping cart when the
		// quantity field in of a shopping cart item is manually changed. This
		// is necessary because the the calculation of the totals and the update
		// of the shopping cart is not directly triggered by a http request.
		// Instead the back end does it automatically during the processing of a
		// http merge request for a shopping cart item
		var oMockRequest = this._calcCartTotalsFromItems();
		oMockRequest.method = "MERGE";
		return oMockRequest;
	},

	_mockWriteAReview: function() {
		// This mock request is used when the a review is created.
		// The following actions are performed:
		// for Product:
		// - set the bHasOwnReview indicator to true
		// - calculate and set the new average rating
		// - increase the RatingCount 1
		// for ReviewAggregation:
		// - increase the counter corresponding to the new rating by 1
		// for Review
		// - replace the dummy id with a correct Id
		// - complete the review data
		return {
			method: "POST",
			path: new RegExp("Reviews"),
			response: jQuery.proxy(function(oXhr) {
				var oDate = new Date(), // date object is needed to create time stamp for the newly created
					oNewReview = {},
					oResponseGetReviewSummary = {},
					oResponseReviewAggr = {},
					sProductId = oXhr.requestBody.substring(oXhr.requestBody.indexOf(":") + 2, oXhr.requestBody.indexOf(",") - 1),
					sNewReviewId = "",
					rNewReviewId = new RegExp("guid\'........-....-....-....-............\'");
				this._resetErrorIndicator();

				// extract the needed data from the Review collection:
				// average rating of the material, data of newly added review.
				sNewReviewId = oXhr.responseText.match(rNewReviewId)[0].substring(5, 41);
				oResponseGetReviewSummary = this._getReviewSummaryForProduct(sProductId, sNewReviewId);
				this._bError = oResponseGetReviewSummary.bError;
				this._sErrorTxt = oResponseGetReviewSummary.sErrorTxt;

				if (!this._bError) {
					//update review aggregates - first get the old ReviewAggregate data
					oResponseReviewAggr = this._sjax({
						url: "ReviewAggregates(ProductId='" + sProductId +
							"', Rating=" + oResponseGetReviewSummary.oReviewSummary.oNewReview.Rating + ")",
						errorText: "Error: 'ReviewAggregates' could not be read from mock data"
					});
				}

				if (!this._bError) {
					//update review aggregates - secondly increase the rating counter by one
					oResponseReviewAggr = this._sjax({
						url: "ReviewAggregates(ProductId='" + sProductId +
							"', Rating=" + oResponseGetReviewSummary.oReviewSummary.oNewReview.Rating + ")",
						type: "PATCH",
						data: {
							RatingCount: oResponseReviewAggr.data.d.RatingCount + 1,
							Rating: oResponseReviewAggr.data.d.Rating
						},
						errorText: "Error: Could not update 'ReviewAggregates' mock data"
					});
				}

				// new reviews are not automatically created with all needed data - fill the gaps
				if (!this._bError && oResponseGetReviewSummary.oReviewSummary.oNewReview) {
					oNewReview = oResponseGetReviewSummary.oReviewSummary.oNewReview;
					oNewReview.ChangedAt = "\/Date(" + oDate.getTime() + ")\/";
					oNewReview.HelpfulCount = 0;
					oNewReview.HelpfulForCurrentUser = false;
					oNewReview.IsReviewOfCurrentUser = true;
					oNewReview.UserDisplayName = "Test User";
					this._sjax({
						url: "Reviews(guid'" + oResponseGetReviewSummary.oReviewSummary.oNewReview.Id + "')",
						type: "PATCH",
						data: {
							ChangedAt: oNewReview.ChangedAt,
							HelpfulCount: oNewReview.HelpfulCount,
							HelpfulForCurrentUser: oNewReview.HelpfulForCurrentUser,
							IsReviewOfCurrentUser: oNewReview.IsReviewOfCurrentUser,
							UserDisplayName: oNewReview.UserDisplayName
						},
						errorText: "Error: Could not update 'Reviews' mock data"
					});
				}

				if (!this._bError) {
					// Update the Product with the data of the new rating
					this._sjax({
						url: "Products('" + sProductId + "')",
						type: "PATCH",
						data: {
							AverageRating: oResponseGetReviewSummary.oReviewSummary.fAverageRating,
							bHasOwnReview: true,
							RatingCount: oResponseGetReviewSummary.oReviewSummary.iRatingForProductCount
						},
						errorText: "Error: Could not update mock data of product " + sProductId
					});
				}
				if (this._bError) {
					oXhr.respond(400, null, this._sErrorTxt);
				} else {
					oXhr.respondJSON(200, {}, JSON.stringify({
						d: oNewReview
					}));
				}
			}, this)
		};
	},
	_mockRateAsHelpful: function() {
		// This mock request is used when the "Rate as Helpful" button of a review
		// is pressed. It increases the "Helpful" count of the review by 1 and sets
		// the HelpfulForCurrentUser indicator to true
		return {
			method: "MERGE",
			path: new RegExp("Reviews(.*)"),
			response: jQuery.proxy(function(oXhr, sUrlReviewId) {
				var oResponseGetReview = null;
				var oResponsePutReview = null;
				var sReviewId = decodeURIComponent(sUrlReviewId); // format:"(guid'...')"
				this._resetErrorIndicator();

				//based on method and path changeReview and rateAsHelpful look identical
				//check if this is really a "RateAsHelpful" request and return if not
				if (this._getRequestBody(oXhr).IsReviewOfCurrentUser) {
					return;
				}

				oResponseGetReview = this._sjax({
					url: "Reviews" + sReviewId,
					errorText: "Error: Review could not be read from mock data"
				});
				if (oResponseGetReview.success) {
					// update the model with the new "helpfulCount"
					var oNewReviewData = oResponseGetReview.data.d;
					oNewReviewData.HelpfulCount = oResponseGetReview.data.d.HelpfulCount + 1;
					oNewReviewData.HelpfulForCurrentUser = true;
					oResponsePutReview = this._sjax({
						url: "Reviews" + sReviewId,
						type: "PUT",
						data: oNewReviewData,
						errorText: "Error: Could not update review mock data"
					});
					if (oResponsePutReview.success) {
						oXhr.respondJSON(204);
					} else {
						oXhr.respond(400, null, "Error: Could not update review mock data");
					}
				} else {
					// If this request fails, it means the mock data was set up
					// incorrectly or the mock server is not working.
					oXhr.respond(400, null, "Error: Review could not be read from mock data");
				}
			}, this)
		};
	},

	_mockDeleteAReview: function() {
		// The following actions need to be performed by the mock request function when a review 
		// is deleted:
		// - update the RatingCount and the AverageRating of the product
		// - update the RatingCount of the ReviewAggregate
		// since the content of the deleted review is not known anymore it is not possible to tell
		// what product and what ReviewAggregate need updates. So Therefore the values have to be 
		// recalculated for all products and all ReviewAggregates
		return {
			method: "DELETE",
			path: new RegExp("Reviews(.*)"),
			response: jQuery.proxy(function(oXhr) {
				var i = 0,
					j = 0,
					sProductId = "",
					oResponseGetReviewSummary = {},
					oResponseGetProducts = {};
				this._resetErrorIndicator();

				//1. get all Products
				oResponseGetProducts = this._sjax({
					url: "Products"
				});

				//2. _getReviewSummaryForProduct for each Product
				while (i < oResponseGetProducts.data.d.results.length && !this._bError) {
					sProductId = oResponseGetProducts.data.d.results[i].Id;
					oResponseGetReviewSummary = this._getReviewSummaryForProduct(sProductId, "");
					this._bError = oResponseGetReviewSummary.bError;
					this._sErrorTxt = oResponseGetReviewSummary.sErrorTxt;

					// update the product with the data
					if (!this._bError) {
						this._sjax({
							url: "Products('" + sProductId + "')",
							type: "MERGE",
							data: {
								RatingCount: oResponseGetReviewSummary.oReviewSummary.iRatingForProductCount,
								AverageRating: oResponseGetReviewSummary.oReviewSummary.fAverageRating
							}
						});
					}

					// update the ReviewAggregate
					j = 0; // reset counter
					while (j < 5 && this._bError === false) {
						this._sjax({
							url: "ReviewAggregates(ProductId='" + sProductId + "', Rating=" + (j + 1).toString() + ")",
							type: "MERGE",
							data: {
								RatingCount: oResponseGetReviewSummary.oReviewSummary.aReviewAggregate[j],
								Rating: j + 1
							}
						});
						j++;
					}
					i++;
				}

				if (this._bError) {
					oXhr.respond(400, null, this._sErrorTxt);
				} else {
					oXhr.respondJSON(204);
				}
			}, this)
		};
	},

	_mockChangeAReview: function() {
		// This mock request is used when the a review is changed.
		// The following actions are performed:
		// for Product:
		// - calculate and set the new average rating
		// for ReviewAggregation:
		// - update the number of ratings ()
		return {
			method: "PUT",
			path: new RegExp("Reviews(.*)"),
			// path : new RegExp("Reviews"),
			response: jQuery.proxy(function(oXhr, sUrlRatingGuid) {
				var oResponseGetRating = {},
					sProductId = "",
					oResponseGetReviewSummary = {},
					sRatingGuid = decodeURIComponent(sUrlRatingGuid);
				this._resetErrorIndicator();
				//based on method and path changeReview and rateAsHelpful look identical
				//check if this is really a "ChangeAReview" request and return if not
				if (!this._getRequestBody(oXhr).IsReviewOfCurrentUser) {
					return;
				}

				// get the product id of the changed rating
				sRatingGuid = sRatingGuid.substring(2, sRatingGuid.length - 2);
				oResponseGetRating = this._sjax({
					url: "Reviews" + sUrlRatingGuid,
					errorText: "Error: Reading 'Reviews' from mock data failed"
				});

				if (!this._bError) {
					sProductId = oResponseGetRating.data.d.ProductId;
					// evaluate all ratings for the product in order to get the new average rating
					oResponseGetReviewSummary = this._getReviewSummaryForProduct(sProductId, "");
					this._bError = oResponseGetReviewSummary.bError;
					this._sErrorTxt = oResponseGetReviewSummary.sErrorTxt;
				}

				if (!this._bError) {
					//update review aggregates 
					for (var j = 0; j < 5; j++) {
						this._sjax({
							url: "ReviewAggregates(ProductId='" + sProductId + "', Rating=" + (j + 1).toString() + ")",
							type: "MERGE",
							data: {
								RatingCount: oResponseGetReviewSummary.oReviewSummary.aReviewAggregate[j],
								Rating: j + 1
							},
							errorText: "Error: Updating 'ReviewAggregates' from mock data failed"
						});
					}
				}

				if (!this._bError) {
					// Update the Product with the data of the new rating
					this._sjax({
						url: "Products('" + sProductId + "')",
						type: "PATCH",
						data: {
							AverageRating: oResponseGetReviewSummary.oReviewSummary.fAverageRating
						},
						errorText: "Error: Updating product " + sProductId + "from mock data failed"
					});
				}

				if (this._bError) {
					oXhr.respond(400, null, this._sErrorTxt);
				} else {
					oXhr.respondJSON(204);
				}

			}, this)
		};
	},
	_getReviewSummaryForProduct: function(sProductId, sNewReviewId) {
		// This method is used to collect data from all reviews or for reviews of a given product.
		// sProductId is the product to collect the data for
		// An object containing the following data is returned:
		//		fAverageRating - the average rating for the product
		//		iRatingForProductCount - the number of existing ratings for the product
		//		oNewReview - the data of a newly created review (with Id = "0") or null if no new
		//                      review exists
		//		aReviewAggregate - array with 5 elements, the first element contains the number 
		//                      of ratings with one star, the second one the number of ratings with 2 stars, ...
		var i = 0,
			sErrorTxt = "",
			bError = false,
			iRatingSum = 0,
			oResponseGetReview = {},
			oReviewSummary = {
				fAverageRating: 0,
				iRatingForProductCount: 0,
				oNewReview: null,
				aReviewAggregate: [0, 0, 0, 0, 0]
			};

		//  evaluate the reviews 
		// for the given product in order to calculate the new average
		// rating + ratingCount

		oResponseGetReview = this._sjax({
			url: "Products('" + sProductId + "')/Reviews"
		});

		if (oResponseGetReview.success) {
			// loop through all reviews to:
			// - find the new review 
			// - calculate the new average rating
			// - collect the ratings for sProductId to build the ReviewAggregate object
			for (i = 0; i < oResponseGetReview.data.d.results.length; i++) {
				if (sProductId === oResponseGetReview.data.d.results[i].ProductId) {
					iRatingSum = iRatingSum + oResponseGetReview.data.d.results[i].Rating;
					oReviewSummary.iRatingForProductCount++;
					oReviewSummary.aReviewAggregate[oResponseGetReview.data.d.results[i].Rating - 1]++;
				}
				// newly created reviews have an intermediate key that does not contain yet the "-" of the a guid 
				if (sNewReviewId && oResponseGetReview.data.d.results[i].Id === sNewReviewId) {
					oReviewSummary.oNewReview = oResponseGetReview.data.d.results[i];
				}
			}
			if (oReviewSummary.iRatingForProductCount === 0) {
				oReviewSummary.fAverageRating = 0;
			} else {
				oReviewSummary.fAverageRating = iRatingSum / oReviewSummary.iRatingForProductCount;
			}
		} else {
			// If this request fails, it means the mock data was set up
			// incorrectly or the mock server is not working.
			bError = true;
			sErrorTxt = "Error: Reading 'Reviews' from mock data failed";
			jQuery.sap.log.error("Error: Reading 'Reviews' from mock data failed");
		}
		return {
			oReviewSummary: oReviewSummary,
			bError: bError,
			sErrorTxt: sErrorTxt
		};
	},

	_checkForError: function(bSuccess, sErrorTxt) {
		// If this request fails, it means the mock data was set up
		// incorrectly or the mock server is not working.
		// setter for the global error flag and error text.
		// bsuccess contains the success flag of the this._sjax request.
		// sErrorTxt contains the text for the specific problem
		if (!bSuccess) {
			this._bError = true;
			this._sErrorTxt = sErrorTxt;
			jQuery.sap.log.error(sErrorTxt);
		}
	},

	_getNewId: function(aIdsInUse) {
		// Creates a new Id as astring
		// aIdsInUse - is a mandatory import parameter - it contains a list of Ids that 
		//              need to be excluded
		// rerurns a new Id as astring
		var sNewId = null,
			iItemCount = 0;

		if (aIdsInUse.length > 0) {
			iItemCount = aIdsInUse.length;
		}
		while (sNewId === null) {
			sNewId = ((iItemCount + 1) * 10).toString();
			if (aIdsInUse.indexOf(sNewId) !== -1) {
				sNewId = null;
				iItemCount++;
			}
		}
		return sNewId;
	},
	_calcCartTotalsFromItems: function() {
		// In this mock function request the total on the shopping cart are updated
		// by adding up the the values of the shopping cart items. The http method
		// is not yet defined because the same logic is needed for "MERGE" and
		// "DELETE" calls. See function "mockDeleteItem" and
		// "mockChangeItemQuantity"
		return {
			path: new RegExp("ShoppingCartItems(.*)"),
			response: jQuery.proxy(function(oXhr, sUrlShoppingCartItemId) {
				var i = 0,
					fTotalValue = 0,
					fTotalQuantity = 0,
					oChangedItem = null,
					oResponseGetShoppingCartItems = null,
					oResponseGetShoppingCart = null,
					oResponseGetProduct = null,
					oResponseItemGet = null,
					sShoppingCartItemId = decodeURIComponent(sUrlShoppingCartItemId);

				this._resetErrorIndicator();

				sShoppingCartItemId = sShoppingCartItemId.substring(2, sShoppingCartItemId.length - 2);

				// the quantity of an item was changed - first adopt the items's value to the new quantity
				if (oXhr.method === "MERGE") {
					// get the item's data
					oResponseItemGet = this._sjax({
						url: "ShoppingCartItems('" + sShoppingCartItemId + "')",
						errorText: "Error: Could not read item " + sShoppingCartItemId + " from mock data"
					});

					if (!this._bError) {
						oChangedItem = oResponseItemGet.data.d;
						// read the items's product to get the value per piece
						oResponseGetProduct = this._sjax({
							url: "Products('" + oChangedItem.ProductId + "')",
							errorText: "Error: No mock data found for product " + oChangedItem.ProductId
						});
					}

					// calculate the new subvalue and set it on the item
					if (!this._bError) {
						//update the item with the new value 
						this._sjax({
							url: "ShoppingCartItems('" + oChangedItem.Id + "')",
							type: "PATCH",
							data: {
								SubTotal: (+oResponseGetProduct.data.d.Price * oChangedItem.Quantity).toString()
							},
							errorText: "Error: Could not update shopping cart item mock data"
						});
					}
				}

				// Get shopping cart items
				oResponseGetShoppingCartItems = this._sjax({
					url: "ShoppingCarts(-1)/ShoppingCartItems",
					errorText: "Error: shopping cart items could not be read from mock data"
				});
				if (!this._bError) {
					// Use the remaining items to add up the totals
					if (oResponseGetShoppingCartItems.data.d.results) {
						for (i = 0; i < oResponseGetShoppingCartItems.data.d.results.length; i++) {
							fTotalValue = fTotalValue + +oResponseGetShoppingCartItems.data.d.results[i].SubTotal;
							fTotalQuantity = fTotalQuantity + +oResponseGetShoppingCartItems.data.d.results[i].Quantity;
						}
					} else {
						// There is no item left so the totals are 0
						fTotalValue = 0;
						fTotalQuantity = 0;
					}
				}

				if (!this._bError) {
					// Get shopping cart
					oResponseGetShoppingCart = this._sjax({
						url: "ShoppingCarts(-1)",
						errorText: "Error: shopping cart could not be read from mock data"
					});
				}
				if (!this._bError) {
					var oNewShoppingCartData = oResponseGetShoppingCart.data.d;
					oNewShoppingCartData.Total = fTotalValue.toString();
					oNewShoppingCartData.TotalQuantity = fTotalQuantity.toString();
					this._sjax({
						url: "ShoppingCarts(-1)",
						type: "PUT",
						data: oNewShoppingCartData,
						errorText: "Error: Could not update shopping cart mock data"
					});
				}
				if (this._bError) {
					oXhr.respond(400, null, this._sErrorTxt);
				} else {
					oXhr.respondJSON(204);
				}
			}, this)
		};
	},
	_resetErrorIndicator: function() {
		this._bError = false; //true if a this._sjax request failed
		this._sErrorTxt = ""; //error text for the oXhr error response
	},
	_sjax: function(oParam) {
		// Wrapper for synchrounous aja calls. 
		// The ajax call is only done if the global error indicator is not set.
		// The following paramters of the import object oParam are evaluated:
		//  url - the service url relative to the base url given in _srvUrl
		//  type (optional) -  the http request type - default is "GET"
		//  data (optional) - the data object that is transfered in changing requests (PT, POST, etc)
		//  errorText (optional) - this txt is written to the console in case of an error
		// Returns the respose object oof the ajax call or null if the global error indicator is true
		var sType = "",
			sUrl = "",
			oResponse = null;
		if (!this._bError) {
			sType = (!oParam.type) ? "GET" : oParam.type;
			sUrl = this._srvUrl + oParam.url;
			if (!oParam.data) {
				oResponse = jQuery.sap.sjax({
					url: sUrl,
					type: sType
				});
			} else {
				oResponse = jQuery.sap.sjax({
					url: sUrl,
					type: sType,
					data: JSON.stringify(oParam.data)
				});
			}
			this._checkForError(oResponse.success, oParam.errorText);
		}
		return oResponse;
	},
	_getRequestBody: function(oXhr) {
		// returns the request body as a Json object
		var oXhrModel = new sap.ui.model.json.JSONModel();
		oXhrModel.setJSON(oXhr.requestBody);
		return oXhrModel.getData();
	}

}; // main object