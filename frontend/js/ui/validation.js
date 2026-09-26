/**
 * Measure X — Form Validation & Metrology Calculation Module
 * Provides inline error rendering and accuracy tolerance validation.
 */

const Validation = {
  // Regex patterns
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,

  /**
   * Validates a form given a configuration map of field IDs and validation rules.
   * Rules: { required: bool, email: bool, phone: bool, minLength: number, numeric: bool }
   */
  validateForm(formElement, rules) {
    let isValid = true;
    this.clearErrors(formElement);

    for (const [fieldId, rule] of Object.entries(rules)) {
      const field = formElement.querySelector(`[name="${fieldId}"]`) || formElement.querySelector(`#${fieldId}`);
      if (!field) continue;

      const val = field.value.trim();

      if (rule.required && !val) {
        this.showError(field, rule.requiredMessage || "This field is required.");
        isValid = false;
        continue;
      }

      if (val && rule.email && !this.EMAIL_REGEX.test(val)) {
        this.showError(field, "Please enter a valid email address.");
        isValid = false;
        continue;
      }

      if (val && rule.phone && !this.PHONE_REGEX.test(val.replace(/[\s-]/g, ''))) {
        this.showError(field, "Please enter a valid phone number.");
        isValid = false;
        continue;
      }

      if (val && rule.numeric && isNaN(Number(val))) {
        this.showError(field, "Please enter a valid number.");
        isValid = false;
        continue;
      }

      if (val && rule.minLength && val.length < rule.minLength) {
        this.showError(field, `Minimum ${rule.minLength} characters required.`);
        isValid = false;
        continue;
      }

      // Mark valid
      field.classList.remove('is-invalid');
      field.classList.add('is-valid');
    }

    return isValid;
  },

  showError(field, message) {
    field.classList.add('is-invalid');
    field.classList.remove('is-valid');

    let errDiv = field.parentElement.querySelector('.field-error');
    if (!errDiv) {
      errDiv = document.createElement('div');
      errDiv.className = 'field-error';
      field.parentElement.appendChild(errDiv);
    }
    errDiv.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;
  },

  clearErrors(formElement) {
    const invalidFields = formElement.querySelectorAll('.is-invalid, .is-valid');
    invalidFields.forEach(f => f.classList.remove('is-invalid', 'is-valid'));

    const errorDivs = formElement.querySelectorAll('.field-error');
    errorDivs.forEach(div => div.remove());
  },

  /**
   * Metrology Accuracy Evaluator
   * Compares Nominal standard, Observed Measurement, and Permissible Tolerance
   * Example: Nominal 50, Observed 50.02, Permissible ±0.05 -> PASS (difference 0.02 <= 0.05)
   */
  evaluateAccuracy(nominalValue, observedValue, permissibleTolerance) {
    const nom = parseFloat(nominalValue);
    const obs = parseFloat(observedValue);
    const tol = Math.abs(parseFloat(permissibleTolerance.toString().replace(/[±+-\s]/g, '')));

    if (isNaN(obs) || isNaN(tol)) {
      return { status: 'INVALID', difference: null, isWithinTolerance: false, message: 'Invalid values' };
    }

    // Default nominal to 50 or nearest rounded if not supplied
    const reference = isNaN(nom) ? Math.round(obs) : nom;
    const diff = Math.abs(obs - reference);
    const isWithin = diff <= tol;

    return {
      status: isWithin ? 'PASS' : 'FAIL',
      nominal: reference,
      observed: obs,
      tolerance: tol,
      difference: diff.toFixed(3),
      isWithinTolerance: isWithin,
      message: isWithin
        ? `Within tolerance (Deviation: ${diff.toFixed(3)} ≤ ±${tol})`
        : `Exceeds tolerance (Deviation: ${diff.toFixed(3)} > ±${tol})`
    };
  }
};

window.Validation = Validation;
