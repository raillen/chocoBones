# User Research Report: Checkout Flow

## Executive Summary
We conducted moderated usability testing with 5 participants to evaluate the new checkout flow. Overall task success rate was 80%, but users struggled significantly with the shipping address input phase.

## Methodology
- **Participants:** 5 (3 female, 2 male), ages 25-45, regular online shoppers.
- **Method:** Moderated remote usability testing via Zoom.
- **Tasks:**
  1. Add a specific item to cart.
  2. Proceed to checkout.
  3. Complete purchase using a dummy credit card.

## Key Findings

### 1. High Friction in Address Autocomplete (Severity: High)
**Observation:** 3 out of 5 users failed to notice the address autocomplete dropdown and manually typed their full address. When they submitted the form, a validation error occurred because the state was not selected.
**Recommendation:** Auto-select the first suggested address if the user presses Tab or Enter, and improve the visual prominence of the dropdown.

### 2. Unclear Shipping Costs (Severity: Medium)
**Observation:** Users expressed hesitation at the payment step because the shipping cost was only labeled as "TBD" until the final confirmation page.
**Recommendation:** Calculate and display estimated shipping costs earlier in the funnel, based on the user's zip code.

## Conclusion
The new layout is visually appealing and generally well-understood, but the address entry mechanism requires immediate redesign before launch to prevent cart abandonment.
