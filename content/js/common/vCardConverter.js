function extractCarrier(tel) {
  var ret = '';
  if (/carrier=(.+)/i.test(tel)) {
    ret = tel.match(/carrier=(.+)/i)[1];
  }
  return ret;
}

vCardConverter = {
  importContacts: function(data) {
    var contacts = [];
    var index = 0;
    var items = vCard.initialize(data);
    items.forEach(function(item) {
      var contact = {
        "name": [],
        "givenName": [],
        "additionalName": [],
        "familyName": [],
        "nickname": [],
        "email": [],
        "photo": [],
        "category": [],
        "adr": [],
        "tel": [],
        "org": [""],
        "jobTitle": [],
        "note": [],
        "url": null,
        "sex": null
      };
      if (item.prodid) {
        //contacts exported from Apple
        if (item.prodid.indexOf('Apple') != -1) {
          if (item.fn && item.fn != '') {
            var name = item.n.split(';');
            contact.familyName = [name[0]];
            contact.givenName = [name[1]];
            if (contact.givenName[0] != '') {
              contact.name.push(contact.givenName[0]);
            }
            if (contact.familyName[0] != '') {
              contact.name.push(contact.familyName[0]);
            }
          }
          if (item.org && item.org != '') {
            contact.org = item.org.split(';');
          }
          if (item.email) {
            for (var e in item.email) {
              if (e.indexOf('type=home') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['home'],
                    'value': email
                  });
                });
                continue;
              }
              if (e.indexOf('type=work') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['work'],
                    'value': email
                  });
                });
                continue;
              }
              item.email[e].forEach(function(email) {
                contact.email.push({
                  'type': ['other'],
                  'value': email
                });
              });
            }
          }
          if (item.tel) {
            for (var e in item.tel) {
              if (e.indexOf('type=voice') != -1) {
                if (e.indexOf('type=cell') != -1 &&
                    e.indexOf('type=iphone') == -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['mobile'],
                      'value': t
                    });
                  });
                  continue;
                }
                if (e.indexOf('type=cell') != -1 &&
                    e.indexOf('type=iphone') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['personal'],
                      'value': t
                    });
                  });
                  continue;
                }
                if (e.indexOf('type=home') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['home'],
                      'value': t
                    });
                  });
                  continue;
                }
                if (e.indexOf('type=work') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['work'],
                      'value': t
                    });
                  });
                  continue;
                }
                if (e.indexOf('type=other') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['another'],
                      'value': t
                    });
                  });
                  continue;
                }
              }
              if (e.indexOf('type=main') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['personal'],
                    'value': t.replace(/-/g, '')
                  });
                });
                continue;
              }
              if (e.indexOf('type=fax') != -1) {
                if (e.indexOf('type=home') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['faxHome'],
                      'value': t
                    });
                  });
                  continue;
                }
                if (e.indexOf('type=work') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['faxOffice'],
                      'value': t
                    });
                  });
                  continue;
                }
                if (e.indexOf('type=other') != -1) {
                  item.tel[e].forEach(function(t) {
                    contact.tel.push({
                      'type': ['faxOther'],
                      'value': t
                    });
                  });
                  continue;
                }
              }
            }
            if (item.adr) {
              for (var e in item.adr) {
                if (e.indexOf('type=home') != -1) {
                  item.adr[e].forEach(function(adr) {
                    var length = adr.length;
                    var address = adr[length - 5].replace('\\n', '');
                    contact.adr.push({
                      "type": ["home"],
                      "streetAddress": address,
                      "locality": adr[length - 3],
                      "postalCode": adr[length - 2],
                      "countryName": adr[length - 1]
                    });
                  });
                }
                if (e.indexOf('type=work') != -1) {
                  item.adr[e].forEach(function(adr) {
                    var length = adr.length;
                    var address = adr[length - 5].replace('\\n', '');
                    contact.adr.push({
                      "type": ["work"],
                      "streetAddress": address,
                      "locality": adr[length - 3],
                      "postalCode": adr[length - 2],
                      "countryName": adr[length - 1]
                    });
                  });
                }
                if (e.indexOf('type=home') == -1 &&
                    e.indexOf('type=work') == -1) {
                  var type = /type=(.+);?/;
                  if (type.test(e)) {
                    var results = e.match(type);
                    item.adr[e].forEach(function(adr) {
                      var length = adr.length;
                      var address = adr[length - 5].replace('\\n', '');
                      contact.adr.push({
                        "type": [results[1]],
                        "streetAddress": address,
                        "locality": adr[length - 3],
                        "postalCode": adr[length - 2],
                        "countryName": adr[length - 1]
                      });
                    });
                  }
                }
              }
            }
          }
        }
      } else {
        if (item.version == '3.0' || item.version == '4.0') {
          if (item.fn && item.fn != '') {
            var name = item.n.split(';');
            contact.familyName = [name[0]];
            contact.givenName = [name[1]];
            if (contact.givenName[0] != '') {
              contact.name.push(contact.givenName[0]);
            }
            if (contact.familyName[0] != '') {
              contact.name.push(contact.familyName[0]);
            }
          }
          if (item.org && item.org != '') {
            contact.org = item.org.split(';');
          }
          if (item.note && item.note != '') {
            contact.note = item.note.split(';');
          }
          if (item.email) {
            for (var e in item.email) {
              if (e.indexOf('type=cell') != -1 ||
                  e.indexOf('type=personal') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['personal'],
                    'value': email
                  });
                });
                continue;
              }
              if (e.indexOf('type=home') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['home'],
                    'value': email
                  });
                });
                continue;
              }
              if (e.indexOf('type=work') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['work'],
                    'value': email
                  });
                });
                continue;
              }
              item.email[e].forEach(function(email) {
                var type = /type=(.+)[;]/;
                var results = ['type=other', 'other'];
                if (!type.test(e)) {
                  type = /type=(.+)[:]/;
                }
                if (!type.test(e)) {
                  type = /type=(.+)/;
                }
                results = e.match(type);
                if (!results || results.length < 2) {
                  contact.email.push({
                    'type': ['custom'],
                    'value': email
                  });
                } else {
                  contact.email.push({
                    'type': [results[1]],
                    'value': email
                  });
                }
              });
            }
          }
          if (item.tel) {
            for (var e in item.tel) {
              var carrier = extractCarrier(e);
              if (e.indexOf('type=cell') != -1 ||
                  e.indexOf('type=mobile') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['mobile'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=home') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['home'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=pref') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['personal'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=voice') != -1 ||
                  e.indexOf('type=personal') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['personal'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=work') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['work'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=faxhome') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['faxHome'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=faxoffice') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['faxOffice'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('type=faxother') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['faxOther'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              item.tel[e].forEach(function(t) {
                var type = /type=(.+)[;]/;
                var results = ['type=other', 'other'];
                if (!type.test(e)) {
                  type = /type=(.+)[:]/;
                }
                if (!type.test(e)) {
                  type = /type=(.+)/;
                }
                results = e.match(type);
                if (!results || results.length < 2) {
                  contact.tel.push({
                    'type': ['custom'],
                    'carrier': carrier,
                    'value': t
                  });
                } else {
                  contact.tel.push({
                    'type': [results[1]],
                    'carrier': carrier,
                    'value': t
                  });
                }
              });
            }
          }
          if (item.adr) {
            for (var e in item.adr) {
              if (e.indexOf('type=home') != -1) {
                item.adr[e].forEach(function(adr) {
                  var length = adr.length;
                  var address = adr[length - 5].replace('\\n', '');
                  contact.adr.push({
                    "type": ["home"],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                });
                continue;
              }
              if (e.indexOf('type=work') != -1) {
                item.adr[e].forEach(function(adr) {
                  var length = adr.length;
                  var address = adr[length - 5].replace('\\n', '');
                  contact.adr.push({
                    "type": ["work"],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                });
                continue;
              }
              item.adr[e].forEach(function(adr) {
                var length = adr.length;
                var address = adr[length - 5].replace('\\n', '');
                var type = /type=(.+)[;]/;
                var results = ['type=other', 'other'];
                if (!type.test(e)) {
                  type = /type=(.+)[:]/;
                }
                if (!type.test(e)) {
                  type = /type=(.+)/;
                }
                results = e.match(type);
                if (!results || results.length < 2) {
                  contact.adr.push({
                    "type": ['custom'],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                } else {
                  contact.adr.push({
                    "type": [results[1]],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                }
              });
            }
          }
          if (item.photo) {
            for (var e in item.photo) {
              if (e.indexOf('encoding=base64') != -1) {
                contact.photo = 'data:image/jpeg;base64,';
                contact.photo += item.photo[e][0];
                break;
              }
            }
          }
        }
        if (item.version == '2.1') {
          if (item.fn && item.fn != '') {
            var fullName = decodeURIComponent(item.n.replace(/=/g, '%'));
            var name = fullName.split(';');
            contact.familyName = [name[0]];
            contact.givenName = [name[1]];
            if (contact.givenName[0] != '') {
              contact.name.push(contact.givenName[0]);
            }
            if (contact.familyName[0] != '') {
              contact.name.push(contact.familyName[0]);
            }
          }
          if (item.org && item.org != '') {
            contact.org =
              decodeURIComponent(item.org.replace(/=/g, '%')).split(';');
          }
          //if (item.note && item.note != '') {
          //  contact.note =
          //      decodeURIComponent(item.note.replace(/=/g,'%')).split(';');
          //}
          if (item.email) {
            for (var e in item.email) {
              if (e.indexOf('cell') != -1 || e.indexOf('personal') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['personal'],
                    'value': email
                  });
                });
                continue;
              }
              if (e.indexOf('home') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['home'],
                    'value': email
                  });
                });
                continue;
              }
              if (e.indexOf('work') != -1) {
                item.email[e].forEach(function(email) {
                  contact.email.push({
                    'type': ['work'],
                    'value': email
                  });
                });
                continue;
              }
              item.email[e].forEach(function(email) {
                var type = /type=(.+)[;]/;
                var results = ['type=other', 'other'];
                if (!type.test(e)) {
                  type = /type=(.+)[:]/;
                }
                if (!type.test(e)) {
                  type = /type=(.+)/;
                }
                results = e.match(type);
                if (!results || results.length < 2) {
                  contact.email.push({
                    'type': ['custom'],
                    'value': email
                  });
                } else {
                  contact.email.push({
                    'type': [results[1]],
                    'value': email
                  });
                }
              });
            }
          }
          if (item.tel) {
            for (var e in item.tel) {
              var carrier = extractCarrier(e);
              if (e.indexOf('cell') != -1 || e.indexOf('type=mobile') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['mobile'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('home') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['home'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('pref') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['personal'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('voice') != -1 || e.indexOf('personal') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['personal'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('work') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['work'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('faxhome') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['faxHome'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('faxoffice') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['faxOffice'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              if (e.indexOf('faxother') != -1) {
                item.tel[e].forEach(function(t) {
                  contact.tel.push({
                    'type': ['faxOther'],
                    'carrier': carrier,
                    'value': t
                  });
                });
                continue;
              }
              item.tel[e].forEach(function(t) {
                var type = /type=(.+)[;]/;
                var results = ['type=other', 'other'];
                if (!type.test(e)) {
                  type = /type=(.+)[:]/;
                }
                if (!type.test(e)) {
                  type = /type=(.+)/;
                }
                results = e.match(type);
                if (!results || results.length < 2) {
                  contact.tel.push({
                    'type': ['custom'],
                    'carrier': carrier,
                    'value': t
                  });
                } else {
                  contact.tel.push({
                    'type': [results[1]],
                    'carrier': carrier,
                    'value': t
                  });
                }
              });
            }
          }
          if (item.adr) {
            for (var e in item.adr) {
              if (e.indexOf('home') != -1) {
                item.adr[e].forEach(function(adr) {
                  var length = adr.length;
                  for (var index = 0; index < length; index++) {
                    adr[index] =
                      decodeURIComponent(adr[index].replace(/=/g, '%'));
                  }
                  var address = adr[length - 5].replace('\\n', '');
                  contact.adr.push({
                    "type": ["home"],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                });
                continue;
              }
              if (e.indexOf('work') != -1) {
                item.adr[e].forEach(function(adr) {
                  var length = adr.length;
                  for (var index = 0; index < length; index++) {
                    adr[index] =
                      decodeURIComponent(adr[index].replace(/=/g, '%'));
                  }
                  var address = adr[length - 5].replace('\\n', '');
                  contact.adr.push({
                    "type": ["work"],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                });
                continue;
              }
              item.adr[e].forEach(function(adr) {
                var length = adr.length;
                for (var index = 0; index < length; index++) {
                  adr[index] =
                    decodeURIComponent(adr[index].replace(/=/g, '%'));
                }
                var address = adr[length - 5].replace('\\n', '');
                var type = /type=(.+)[;]/;
                var results = ['type=other', 'other'];
                if (!type.test(e)) {
                  type = /type=(.+)[:]/;
                }
                if (!type.test(e)) {
                  type = /type=(.+)/;
                }
                results = e.match(type);
                if (!results || results.length < 2) {
                  contact.adr.push({
                    "type": ['custom'],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                } else {
                  contact.adr.push({
                    "type": [results[1]],
                    "streetAddress": address,
                    "locality": adr[length - 3],
                    "postalCode": adr[length - 2],
                    "countryName": adr[length - 1]
                  });
                }
              });
            }
          }
          if (item.photo) {
            for (var e in item.photo) {
              if (e.indexOf('encoding=base64') != -1) {
                contact.photo = 'data:image/jpeg;base64,';
                contact.photo += item.photo[e].join('');
                break;
              }
            }
          }
        }
      }
      contacts.push(JSON.stringify(contact));
    });
    return contacts;
  },
  exportContact: function(contact) {
    var vcard = 'BEGIN:VCARD';
    vcard += '\nVERSION:3.0';
    if (contact.name && contact.name.length > 0) {
      vcard += '\nN:';
      if (contact.familyName && contact.familyName.length > 0) {
        vcard += contact.familyName[0];
      }

      vcard += ';';
      if (contact.givenName && contact.givenName.length > 0) {
        vcard += contact.givenName[0];
      }

      vcard += ';;;';
      vcard += '\nFN:';

      if (contact.familyName && contact.familyName.length > 0) {
        vcard += contact.familyName[0] + ' ';
      }

      if (contact.givenName && contact.givenName.length > 0) {
        vcard += contact.givenName[0];
      }
    }

    if (contact.org && contact.org.length > 0) {
      vcard += '\nORG:';
      contact.org.forEach(function(org) {
        vcard += org + ';';
      });
    }

    if (contact.tel && contact.tel.length > 0) {
      contact.tel.forEach(function(t) {
        vcard += '\nTEL;TYPE=' + t.type;
        if (t.carrier && t.carrier != '') {
          vcard += ';carrier=' + t.carrier;
        }
        vcard += ':' + t.value;
      });
    }

    if (contact.email && contact.email.length > 0) {
      contact.email.forEach(function(e) {
        vcard += '\nEMAIL;TYPE=' + e.type + ':' + e.value;
      });
    }

    if (contact.adr && contact.adr.length > 0) {
      contact.adr.forEach(function(adr) {
        vcard += '\nADR;TYPE=' + adr.type + ':;;';
        if (adr.streetAddress) {
          vcard += adr.streetAddress;
        }
        vcard += ';';
        if (adr.locality) {
          vcard += adr.locality;
        }
        vcard += ';';
        if (adr.region) {
          vcard += adr.region;
        }
        vcard += ';';
        if (adr.postalCode) {
          vcard += adr.postalCode;
        }
        vcard += ';';
        if (adr.countryName) {
          vcard += adr.countryName;
        }
      });
    }

    if (contact.photo && contact.photo.length > 0) {
      vcard += '\nPHOTO;';
      var cur1 = contact.photo.indexOf('/');
      var cur2 = contact.photo.indexOf(';');
      var cur3 = contact.photo.indexOf(',');
      vcard += 'TYPE=' + contact.photo.substring(cur1 + 1, cur2);
      vcard += ';ENCODING=' + contact.photo.substring(cur2 + 1, cur3);
      vcard += ':' + contact.photo.substr(cur3 + 1);
    }

    if (contact.note && contact.note.length > 0) {
      vcard += '\nnote:';
      contact.note.forEach(function(note) {
        vcard += note + ';';
      });
    }

    vcard += '\nEND:VCARD';
    return vcard;
  }
}
