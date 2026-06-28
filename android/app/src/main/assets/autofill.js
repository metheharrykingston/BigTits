(function (profile, fields, pauseKeywords) {
  function norm(s) {
    return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function pageText() {
    return norm(document.body ? document.body.innerText : '');
  }

  for (var i = 0; i < pauseKeywords.length; i++) {
    if (pageText().indexOf(norm(pauseKeywords[i])) >= 0) {
      return { paused: true, filled: 0, failed: 0, reason: 'pause_keyword' };
    }
  }

  var sensitive = /otp|captcha|password|aadhaar|biometric|declaration|payment|submit|e-sign/i;
  var inputs = Array.prototype.slice.call(document.querySelectorAll('input, textarea, select'));
  var filled = 0;
  var failed = 0;

  function labelFor(el) {
    if (el.id) {
      var lab = document.querySelector('label[for="' + el.id + '"]');
      if (lab) return norm(lab.textContent);
    }
    var parent = el.closest('div, td, tr, li, fieldset');
    return norm(parent ? parent.textContent : '');
  }

  function matches(label, variants) {
    for (var j = 0; j < variants.length; j++) {
      if (label.indexOf(norm(variants[j])) >= 0) return true;
    }
    return false;
  }

  for (var f = 0; f < fields.length; f++) {
    var field = fields[f];
    var value = profile[field.profile_key];
    if (!value) continue;

    var done = false;
    for (var k = 0; k < inputs.length; k++) {
      var el = inputs[k];
      if (el.type === 'hidden' || el.disabled || el.readOnly) continue;
      var nameId = norm((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || ''));
      var label = labelFor(el);
      if (!matches(label, field.label_variants) && !matches(nameId, field.label_variants)) continue;
      if (sensitive.test(label) || sensitive.test(nameId)) continue;

      try {
        if (el.tagName === 'SELECT') {
          for (var o = 0; o < el.options.length; o++) {
            if (norm(el.options[o].text).indexOf(norm(value)) >= 0) {
              el.value = el.options[o].value;
              break;
            }
          }
        } else {
          el.focus();
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        filled++;
        done = true;
        break;
      } catch (e) {
        failed++;
        done = true;
        break;
      }
    }
    if (!done) failed++;
  }

  return { paused: false, filled: filled, failed: failed };
})