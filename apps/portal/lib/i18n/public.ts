/**
 * Strings for the public portal (CLAUDE.md §25: en / hi / mr).
 *
 * needs_native_review: every Hindi (hi) and Marathi (mr) string below is a first draft and must be
 * checked by a native speaker before it is treated as final (CLAUDE.md §9 Frontend).
 *
 * The `hi` and `mr` tables are typed against `en`, so a missing key fails typecheck.
 * Statutory numbers (window lengths, thresholds) are deliberately NOT written here (G8).
 */

export const LANGS = ['en', 'hi', 'mr'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_COOKIE = 'bs_lang';
export const LANG_NAMES: Record<Lang, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };
export const LANG_LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export function parseLang(v: string | undefined | null): Lang {
  return v === 'hi' || v === 'mr' ? v : 'en';
}

const en = {
  'nav.home': 'Public portal',
  'nav.search': 'Find my land',
  'nav.notices': 'Notices',
  'nav.myLand': 'My land & compensation',
  'nav.grievance': 'Grievances & help',
  'nav.track': 'Track grievance',
  'nav.signIn': 'Citizen sign-in',
  'nav.objection': 'File an objection',
  'nav.label': 'Public portal sections',
  'lang.label': 'Language',

  'footer.provenance':
    'This portal displays information as recorded by the concerned authority. For the authoritative record, contact the office of the Collector.',
  'footer.asOf': 'Data shown as of {time}.',
  'footer.asOfUnknown': 'Time of data not available right now.',
  'footer.demo': 'Demo data: every record on this portal is synthetic.',
  'footer.officer': 'Officer sign in',

  'common.loading': 'Loading…',
  'common.network': 'Could not reach the server. Check your connection and try again.',
  'common.serverError': 'The server could not answer this request. Try again in a minute.',
  'common.tooMany': 'Too many requests from your connection. Wait a minute and try again.',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.dash': '—',

  'home.title': 'Land acquisition information for citizens',
  'home.intro':
    'Check whether your land is part of an acquisition, read published notices, follow your compensation and raise an objection or complaint. You do not need to sign in.',
  'home.search': 'Search by village and survey number to see the project, its stage and the status of your parcel.',
  'home.notices': 'Read preliminary notifications, declarations and approved R&R schemes as they are published.',
  'home.myLand': 'Open your R&R passbook or confirm a payment using the link the Collector’s office sent you.',
  'home.grievance': 'Find the right way to object, report a payment you did not receive, or contact the office.',

  'search.title': 'Find my land',
  'search.intro': 'Choose your village, then add the survey number if you know it.',
  'search.village': 'Village',
  'search.villagePlaceholder': 'Type at least 2 letters of the village name',
  'search.villageNone': 'No village matches. Check the spelling, or try the name in English.',
  'search.villageChosen': 'Selected: {village}',
  'search.villageChange': 'Change village',
  'search.survey': 'Survey number (optional)',
  'search.surveyHint': 'For example 112 or 112/2',
  'search.submit': 'Search',
  'search.needVillage': 'Choose a village from the list first.',
  'search.count': '{n} record(s) found',
  'search.empty':
    'No acquisition record was found for this village and survey number. If you have received a notice, contact the office of the Collector.',

  'parcel.survey': 'Survey no.',
  'parcel.project': 'Project',
  'parcel.stage': 'Current stage',
  'parcel.status': 'Parcel status',
  'parcel.projectStatus': 'Project status',
  'parcel.affected': 'Share of parcel affected',
  'parcel.frozen': 'Land transfers frozen',
  'parcel.lastNotice': 'Last public notice',
  'parcel.contact': 'Contact',
  'parcel.contactValue': 'Office of the Collector, {district} district',
  'parcel.notices': 'View notices for this project',
  'parcel.object': 'File an objection',

  'notices.title': 'Published notices',
  'notices.intro': 'Notifications, declarations and R&R schemes published for each project.',
  'notices.filter': 'Project code',
  'notices.filterHint': 'You can find the project code in your parcel search result.',
  'notices.apply': 'Show notices',
  'notices.clear': 'Show all projects',
  'notices.empty': 'No published notices were found.',
  'notices.type': 'Notice',
  'notices.docTitle': 'Title',
  'notices.published': 'Published',
  'notices.language': 'Language',
  'notices.fingerprint': 'Document fingerprint',
  'notices.copy':
    'To get a copy of a notice, visit the office of the Collector. The fingerprint (SHA-256) lets anyone check that a copy matches the published document.',

  'objection.title': 'File an objection',
  'objection.intro':
    'After a preliminary notification (s.15 of the 2013 Act), anyone interested in the land can object while the objection window is open. The Collector hears every objection.',
  'objection.prefill': 'Tip: start from Find my land. Choosing a parcel there fills in the first three fields.',
  'objection.project': 'Project code',
  'objection.village': 'Village code',
  'objection.survey': 'Survey number',
  'objection.surveyHint': 'Exactly as shown in the search result, for example 112/2',
  'objection.name': 'Your name (optional)',
  'objection.body': 'Your objection',
  'objection.bodyHint':
    'Say what you object to and why, for example the area taken, the public purpose, or the social impact findings. At least 10 characters.',
  'objection.privacy': 'Do not write Aadhaar, bank account or phone numbers in this form.',
  'objection.demo': 'Demo mode: use made-up details only.',
  'objection.submit': 'Submit objection',
  'objection.submitting': 'Submitting…',
  'objection.rejected': 'The objection was not accepted.',
  'objection.done': 'Objection submitted',
  'objection.reference': 'Your reference: {ref}',
  'objection.keepRef': 'Keep this reference. Quote it when you contact the office of the Collector about your objection.',
  'objection.another': 'File another objection',
  'objection.tooShort': 'Write at least 10 characters.',

  'myLand.title': 'My land & compensation',
  'myLand.intro':
    'There is no account to create and no password. The office of the Collector sends you secure links, by SMS or as a QR code at a camp. Each link opens one thing for you.',
  'myLand.parcelTitle': 'Is my land being acquired?',
  'myLand.parcelDesc': 'Search by village and survey number. You do not need to give any personal details.',
  'myLand.parcelAction': 'Find my land',
  'myLand.passbookTitle': 'My R&R passbook',
  'myLand.passbookDesc':
    'See what your family is entitled to, what has been paid, what is still due and your resettlement site. Use the passbook link sent to you.',
  'myLand.ackTitle': 'Confirm a payment',
  'myLand.ackDesc':
    'When a payment is made, you get a link to confirm that you received it. On the same page you can say that you did not receive it.',
  'myLand.linkLabel': 'Paste your link or code',
  'myLand.linkPlaceholder': 'Paste the full link from your SMS',
  'myLand.open': 'Open',
  'myLand.badLink': 'This does not look like a valid link. Paste the full link exactly as you received it.',
  'myLand.noLink': 'No link? Ask the office of the Collector or the Administrator for R&R to send one.',
  'myLand.privacyTitle': 'Your privacy',
  'myLand.privacyBody':
    'This portal never asks for Aadhaar. If you confirm a payment with your fingerprint or face, the check happens only on your own phone. No fingerprint or image of it is sent or stored.',

  'grievance.title': 'Grievances & help',
  'grievance.intro':
    'File a grievance below and follow it with its tracking number, or use one of the legal channels further down.',
  'grievance.objectionTitle': 'I object to my land being acquired',
  'grievance.objectionDesc':
    'The Collector hears objections, but only while the objection window after the preliminary notification is open.',
  'grievance.objectionAction': 'File an objection',
  'grievance.disputeTitle': 'A payment shows as paid, but I did not receive it',
  'grievance.disputeDesc':
    'Open the payment link sent to you and choose “I did not receive this”. The payment is flagged for the Collector.',
  'grievance.disputeAction': 'Open my payment link',
  'grievance.passbookTitle': 'I want to know what I am owed or what is pending',
  'grievance.passbookDesc': 'Your R&R passbook shows each entitlement, what is paid and what is still due.',
  'grievance.passbookAction': 'Open my passbook',
  'grievance.collectorTitle': 'Something else',
  'grievance.collectorDesc':
    'For a wrong name or area in the records, a claim for compensation, problems at a resettlement site, or an objection after the window has closed, contact the office of the Collector for your district. Your parcel search result shows the district.',
  'grievance.collectorAction': 'Find my district',
  'grievance.keepRef': 'Keep any reference number you are given, and quote it when you contact the office.',

  'stage.S01_PROPOSAL': 'Proposal',
  'stage.S02_SIA': 'Social impact assessment',
  'stage.S03_APPRAISAL': 'Expert appraisal',
  'stage.S04_CONSENT': 'Consent',
  'stage.S05_NOTIFICATION': 'Preliminary notification and objections',
  'stage.S06_RNR_SCHEME': 'R&R scheme',
  'stage.S07_DECLARATION': 'Declaration',
  'stage.S08_AWARD': 'Award',
  'stage.S09_PAYMENT_POSSESSION': 'Payment and possession',
  'stage.S10_POST_ACQUISITION': 'After acquisition',

  'parcelStatus.PROPOSED': 'Proposed',
  'parcelStatus.VERIFICATION_PENDING': 'Verification pending',
  'parcelStatus.VERIFIED': 'Verified',
  'parcelStatus.CONSENT_ACQUIRED_NOTIFIED': 'Notified',
  'parcelStatus.CLEARED_FOR_AWARD_RNR': 'Cleared for award',
  'parcelStatus.AWARDED': 'Award made',
  'parcelStatus.READY_FOR_POSSESSION': 'Ready for possession',
  'parcelStatus.ACQUIRED_POSSESSED': 'Acquired',
  'parcelStatus.CLOSED': 'Closed',
  'parcelStatus.DENOTIFIED': 'Released (denotified)',
  'parcelStatus.TERMINATED': 'Dropped',

  'projectStatus.SUBMITTED': 'Submitted',
  'projectStatus.ACTIVE': 'Active',
  'projectStatus.ON_HOLD': 'On hold',
  'projectStatus.TERMINATED': 'Terminated',
  'projectStatus.DENOTIFIED': 'Denotified',
  'projectStatus.ABANDONED': 'Abandoned',
  'projectStatus.LAPSED': 'Lapsed',
  'projectStatus.CLOSED': 'Closed',

  'docType.S11_NOTIFICATION': 'Preliminary notification (s.11)',
  'docType.S19_DECLARATION': 'Declaration (s.19)',
  'docType.RNR_SCHEME_APPROVED': 'Approved R&R scheme',
  'docType.GAZETTE_COPY': 'Gazette copy',
  'docType.DENOTIFICATION_ORDER': 'Denotification order',
};

export type MsgKey = keyof typeof en;
export type Messages = Record<MsgKey, string>;

const hi: Messages = {
  'nav.home': 'सार्वजनिक पोर्टल',
  'nav.search': 'मेरी ज़मीन खोजें',
  'nav.notices': 'सूचनाएँ',
  'nav.myLand': 'मेरी ज़मीन और मुआवज़ा',
  'nav.grievance': 'शिकायत और सहायता',
  'nav.track': 'शिकायत की स्थिति',
  'nav.signIn': 'नागरिक लॉगिन',
  'nav.objection': 'आपत्ति दर्ज करें',
  'nav.label': 'सार्वजनिक पोर्टल के भाग',
  'lang.label': 'भाषा',

  'footer.provenance':
    'यह पोर्टल संबंधित प्राधिकारी द्वारा दर्ज जानकारी दिखाता है। आधिकारिक अभिलेख के लिए कलेक्टर कार्यालय से संपर्क करें।',
  'footer.asOf': 'जानकारी {time} तक की है।',
  'footer.asOfUnknown': 'जानकारी का समय अभी उपलब्ध नहीं है।',
  'footer.demo': 'डेमो डेटा: इस पोर्टल का हर रिकॉर्ड काल्पनिक है।',
  'footer.officer': 'अधिकारी लॉग इन',

  'common.loading': 'लोड हो रहा है…',
  'common.network': 'सर्वर से संपर्क नहीं हो सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  'common.serverError': 'सर्वर इस अनुरोध का उत्तर नहीं दे सका। एक मिनट बाद फिर कोशिश करें।',
  'common.tooMany': 'आपके कनेक्शन से बहुत अधिक अनुरोध आए हैं। एक मिनट रुककर फिर कोशिश करें।',
  'common.yes': 'हाँ',
  'common.no': 'नहीं',
  'common.dash': '—',

  'home.title': 'नागरिकों के लिए भूमि अधिग्रहण की जानकारी',
  'home.intro':
    'देखें कि आपकी ज़मीन किसी अधिग्रहण में शामिल है या नहीं, प्रकाशित सूचनाएँ पढ़ें, अपने मुआवज़े की स्थिति देखें और आपत्ति या शिकायत दर्ज करें। लॉग इन की ज़रूरत नहीं है।',
  'home.search': 'गाँव और सर्वे नंबर से खोजें और परियोजना, उसका चरण तथा अपने भूखंड की स्थिति देखें।',
  'home.notices': 'प्रारंभिक अधिसूचनाएँ, घोषणाएँ और स्वीकृत पुनर्वास योजनाएँ प्रकाशित होते ही पढ़ें।',
  'home.myLand': 'कलेक्टर कार्यालय से मिले लिंक से अपनी पुनर्वास पासबुक खोलें या भुगतान की पुष्टि करें।',
  'home.grievance': 'आपत्ति करने, न मिले भुगतान की सूचना देने या कार्यालय से संपर्क करने का सही रास्ता जानें।',

  'search.title': 'मेरी ज़मीन खोजें',
  'search.intro': 'अपना गाँव चुनें, फिर पता हो तो सर्वे नंबर डालें।',
  'search.village': 'गाँव',
  'search.villagePlaceholder': 'गाँव के नाम के कम से कम 2 अक्षर लिखें',
  'search.villageNone': 'कोई गाँव नहीं मिला। वर्तनी जाँचें या नाम अंग्रेज़ी में लिखकर देखें।',
  'search.villageChosen': 'चुना गया: {village}',
  'search.villageChange': 'गाँव बदलें',
  'search.survey': 'सर्वे नंबर (वैकल्पिक)',
  'search.surveyHint': 'जैसे 112 या 112/2',
  'search.submit': 'खोजें',
  'search.needVillage': 'पहले सूची से गाँव चुनें।',
  'search.count': '{n} रिकॉर्ड मिले',
  'search.empty':
    'इस गाँव और सर्वे नंबर के लिए अधिग्रहण का कोई रिकॉर्ड नहीं मिला। यदि आपको कोई सूचना मिली है तो कलेक्टर कार्यालय से संपर्क करें।',

  'parcel.survey': 'सर्वे नं.',
  'parcel.project': 'परियोजना',
  'parcel.stage': 'वर्तमान चरण',
  'parcel.status': 'भूखंड की स्थिति',
  'parcel.projectStatus': 'परियोजना की स्थिति',
  'parcel.affected': 'भूखंड का प्रभावित हिस्सा',
  'parcel.frozen': 'ज़मीन का हस्तांतरण रोका गया',
  'parcel.lastNotice': 'अंतिम सार्वजनिक सूचना',
  'parcel.contact': 'संपर्क',
  'parcel.contactValue': 'कलेक्टर कार्यालय, ज़िला {district}',
  'parcel.notices': 'इस परियोजना की सूचनाएँ देखें',
  'parcel.object': 'आपत्ति दर्ज करें',

  'notices.title': 'प्रकाशित सूचनाएँ',
  'notices.intro': 'हर परियोजना के लिए प्रकाशित अधिसूचनाएँ, घोषणाएँ और पुनर्वास योजनाएँ।',
  'notices.filter': 'परियोजना कोड',
  'notices.filterHint': 'परियोजना कोड आपके भूखंड खोज परिणाम में मिलेगा।',
  'notices.apply': 'सूचनाएँ दिखाएँ',
  'notices.clear': 'सभी परियोजनाएँ दिखाएँ',
  'notices.empty': 'कोई प्रकाशित सूचना नहीं मिली।',
  'notices.type': 'सूचना',
  'notices.docTitle': 'शीर्षक',
  'notices.published': 'प्रकाशन',
  'notices.language': 'भाषा',
  'notices.fingerprint': 'दस्तावेज़ फ़िंगरप्रिंट',
  'notices.copy':
    'सूचना की प्रति के लिए कलेक्टर कार्यालय जाएँ। फ़िंगरप्रिंट (SHA-256) से कोई भी जाँच सकता है कि प्रति प्रकाशित दस्तावेज़ से मेल खाती है।',

  'objection.title': 'आपत्ति दर्ज करें',
  'objection.intro':
    'प्रारंभिक अधिसूचना के बाद (2013 अधिनियम की धारा 15), ज़मीन में हित रखने वाला कोई भी व्यक्ति आपत्ति अवधि खुली रहने तक आपत्ति कर सकता है। हर आपत्ति की सुनवाई कलेक्टर करते हैं।',
  'objection.prefill': 'सुझाव: “मेरी ज़मीन खोजें” से शुरू करें। वहाँ भूखंड चुनने पर पहले तीन खाने अपने आप भर जाते हैं।',
  'objection.project': 'परियोजना कोड',
  'objection.village': 'गाँव कोड',
  'objection.survey': 'सर्वे नंबर',
  'objection.surveyHint': 'खोज परिणाम में जैसा दिखा है वैसा ही, जैसे 112/2',
  'objection.name': 'आपका नाम (वैकल्पिक)',
  'objection.body': 'आपकी आपत्ति',
  'objection.bodyHint':
    'बताएँ कि आपको किस बात पर आपत्ति है और क्यों, जैसे ली जा रही ज़मीन, सार्वजनिक प्रयोजन, या सामाजिक प्रभाव के निष्कर्ष। कम से कम 10 अक्षर।',
  'objection.privacy': 'इस फ़ॉर्म में आधार, बैंक खाता या फ़ोन नंबर न लिखें।',
  'objection.demo': 'डेमो मोड: केवल काल्पनिक जानकारी भरें।',
  'objection.submit': 'आपत्ति भेजें',
  'objection.submitting': 'भेजी जा रही है…',
  'objection.rejected': 'आपत्ति स्वीकार नहीं हुई।',
  'objection.done': 'आपत्ति दर्ज हो गई',
  'objection.reference': 'आपका संदर्भ: {ref}',
  'objection.keepRef': 'यह संदर्भ संभालकर रखें। अपनी आपत्ति के बारे में कलेक्टर कार्यालय से संपर्क करते समय इसे बताएँ।',
  'objection.another': 'एक और आपत्ति दर्ज करें',
  'objection.tooShort': 'कम से कम 10 अक्षर लिखें।',

  'myLand.title': 'मेरी ज़मीन और मुआवज़ा',
  'myLand.intro':
    'कोई खाता या पासवर्ड बनाने की ज़रूरत नहीं है। कलेक्टर कार्यालय आपको SMS से या शिविर में QR कोड के रूप में सुरक्षित लिंक भेजता है। हर लिंक आपके लिए एक काम खोलता है।',
  'myLand.parcelTitle': 'क्या मेरी ज़मीन अधिग्रहित हो रही है?',
  'myLand.parcelDesc': 'गाँव और सर्वे नंबर से खोजें। कोई निजी जानकारी देने की ज़रूरत नहीं है।',
  'myLand.parcelAction': 'मेरी ज़मीन खोजें',
  'myLand.passbookTitle': 'मेरी पुनर्वास पासबुक',
  'myLand.passbookDesc':
    'देखें कि आपके परिवार को क्या मिलना है, कितना भुगतान हुआ, कितना बाकी है और आपका पुनर्वास स्थल कौन-सा है। आपको भेजा गया पासबुक लिंक इस्तेमाल करें।',
  'myLand.ackTitle': 'भुगतान की पुष्टि करें',
  'myLand.ackDesc':
    'भुगतान होने पर आपको उसकी प्राप्ति की पुष्टि का लिंक मिलता है। उसी पेज पर आप बता सकते हैं कि भुगतान नहीं मिला।',
  'myLand.linkLabel': 'अपना लिंक या कोड चिपकाएँ',
  'myLand.linkPlaceholder': 'SMS में आया पूरा लिंक चिपकाएँ',
  'myLand.open': 'खोलें',
  'myLand.badLink': 'यह मान्य लिंक नहीं लगता। जैसा मिला था वैसा ही पूरा लिंक चिपकाएँ।',
  'myLand.noLink': 'लिंक नहीं है? कलेक्टर कार्यालय या पुनर्वास प्रशासक से लिंक भेजने को कहें।',
  'myLand.privacyTitle': 'आपकी निजता',
  'myLand.privacyBody':
    'यह पोर्टल कभी आधार नहीं माँगता। यदि आप फ़िंगरप्रिंट या चेहरे से भुगतान की पुष्टि करते हैं, तो जाँच केवल आपके अपने फ़ोन पर होती है। फ़िंगरप्रिंट या उसकी छवि न भेजी जाती है, न रखी जाती है।',

  'grievance.title': 'शिकायत और सहायता',
  'grievance.intro':
    'नीचे शिकायत दर्ज करें और ट्रैकिंग नंबर से उसकी स्थिति देखें, या नीचे दिए गए कानूनी माध्यमों में से किसी एक का उपयोग करें।',
  'grievance.objectionTitle': 'मुझे अपनी ज़मीन के अधिग्रहण पर आपत्ति है',
  'grievance.objectionDesc':
    'आपत्तियों की सुनवाई कलेक्टर करते हैं, लेकिन केवल तब तक जब तक प्रारंभिक अधिसूचना के बाद आपत्ति अवधि खुली है।',
  'grievance.objectionAction': 'आपत्ति दर्ज करें',
  'grievance.disputeTitle': 'भुगतान हुआ दिख रहा है, पर मुझे नहीं मिला',
  'grievance.disputeDesc':
    'आपको भेजा गया भुगतान लिंक खोलें और “मुझे यह नहीं मिला” चुनें। भुगतान कलेक्टर के ध्यान में लाया जाता है।',
  'grievance.disputeAction': 'मेरा भुगतान लिंक खोलें',
  'grievance.passbookTitle': 'मुझे जानना है कि मुझे क्या मिलना है या क्या बाकी है',
  'grievance.passbookDesc': 'आपकी पुनर्वास पासबुक हर हक़, हुआ भुगतान और बाकी राशि दिखाती है।',
  'grievance.passbookAction': 'मेरी पासबुक खोलें',
  'grievance.collectorTitle': 'कोई और समस्या',
  'grievance.collectorDesc':
    'रिकॉर्ड में गलत नाम या क्षेत्रफल, मुआवज़े का दावा, पुनर्वास स्थल की समस्या, या आपत्ति अवधि बंद होने के बाद की आपत्ति के लिए अपने ज़िले के कलेक्टर कार्यालय से संपर्क करें। आपका ज़िला भूखंड खोज परिणाम में दिखता है।',
  'grievance.collectorAction': 'मेरा ज़िला खोजें',
  'grievance.keepRef': 'मिला हुआ कोई भी संदर्भ नंबर संभालकर रखें और कार्यालय से संपर्क करते समय बताएँ।',

  'stage.S01_PROPOSAL': 'प्रस्ताव',
  'stage.S02_SIA': 'सामाजिक प्रभाव आकलन',
  'stage.S03_APPRAISAL': 'विशेषज्ञ मूल्यांकन',
  'stage.S04_CONSENT': 'सहमति',
  'stage.S05_NOTIFICATION': 'प्रारंभिक अधिसूचना और आपत्तियाँ',
  'stage.S06_RNR_SCHEME': 'पुनर्वास योजना',
  'stage.S07_DECLARATION': 'घोषणा',
  'stage.S08_AWARD': 'अवार्ड',
  'stage.S09_PAYMENT_POSSESSION': 'भुगतान और कब्ज़ा',
  'stage.S10_POST_ACQUISITION': 'अधिग्रहण के बाद',

  'parcelStatus.PROPOSED': 'प्रस्तावित',
  'parcelStatus.VERIFICATION_PENDING': 'सत्यापन लंबित',
  'parcelStatus.VERIFIED': 'सत्यापित',
  'parcelStatus.CONSENT_ACQUIRED_NOTIFIED': 'अधिसूचित',
  'parcelStatus.CLEARED_FOR_AWARD_RNR': 'अवार्ड हेतु स्वीकृत',
  'parcelStatus.AWARDED': 'अवार्ड पारित',
  'parcelStatus.READY_FOR_POSSESSION': 'कब्ज़े के लिए तैयार',
  'parcelStatus.ACQUIRED_POSSESSED': 'अधिग्रहित',
  'parcelStatus.CLOSED': 'बंद',
  'parcelStatus.DENOTIFIED': 'मुक्त (अधिसूचना रद्द)',
  'parcelStatus.TERMINATED': 'छोड़ा गया',

  'projectStatus.SUBMITTED': 'प्रस्तुत',
  'projectStatus.ACTIVE': 'सक्रिय',
  'projectStatus.ON_HOLD': 'रुका हुआ',
  'projectStatus.TERMINATED': 'समाप्त',
  'projectStatus.DENOTIFIED': 'अधिसूचना रद्द',
  'projectStatus.ABANDONED': 'त्यागा गया',
  'projectStatus.LAPSED': 'व्यपगत',
  'projectStatus.CLOSED': 'बंद',

  'docType.S11_NOTIFICATION': 'प्रारंभिक अधिसूचना (धारा 11)',
  'docType.S19_DECLARATION': 'घोषणा (धारा 19)',
  'docType.RNR_SCHEME_APPROVED': 'स्वीकृत पुनर्वास योजना',
  'docType.GAZETTE_COPY': 'राजपत्र प्रति',
  'docType.DENOTIFICATION_ORDER': 'अधिसूचना रद्द करने का आदेश',
};

const mr: Messages = {
  'nav.home': 'सार्वजनिक पोर्टल',
  'nav.search': 'माझी जमीन शोधा',
  'nav.notices': 'सूचना',
  'nav.myLand': 'माझी जमीन व मोबदला',
  'nav.grievance': 'तक्रारी व मदत',
  'nav.track': 'तक्रारीची स्थिती',
  'nav.signIn': 'नागरिक लॉगिन',
  'nav.objection': 'हरकत नोंदवा',
  'nav.label': 'सार्वजनिक पोर्टलचे विभाग',
  'lang.label': 'भाषा',

  'footer.provenance':
    'हे पोर्टल संबंधित प्राधिकरणाने नोंदवलेली माहिती दाखवते. अधिकृत नोंदीसाठी जिल्हाधिकारी कार्यालयाशी संपर्क साधा.',
  'footer.asOf': 'माहिती {time} पर्यंतची आहे.',
  'footer.asOfUnknown': 'माहितीची वेळ सध्या उपलब्ध नाही.',
  'footer.demo': 'डेमो डेटा: या पोर्टलवरील प्रत्येक नोंद काल्पनिक आहे.',
  'footer.officer': 'अधिकारी लॉग इन',

  'common.loading': 'लोड होत आहे…',
  'common.network': 'सर्व्हरशी संपर्क झाला नाही. कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
  'common.serverError': 'सर्व्हर या विनंतीला उत्तर देऊ शकला नाही. एका मिनिटाने पुन्हा प्रयत्न करा.',
  'common.tooMany': 'तुमच्या कनेक्शनवरून खूप विनंत्या आल्या आहेत. एक मिनिट थांबून पुन्हा प्रयत्न करा.',
  'common.yes': 'होय',
  'common.no': 'नाही',
  'common.dash': '—',

  'home.title': 'नागरिकांसाठी भूसंपादनाची माहिती',
  'home.intro':
    'तुमची जमीन एखाद्या भूसंपादनात आहे का ते पाहा, प्रसिद्ध सूचना वाचा, मोबदल्याची स्थिती पाहा आणि हरकत किंवा तक्रार नोंदवा. लॉग इन करण्याची गरज नाही.',
  'home.search': 'गाव आणि सर्व्हे नंबरने शोधा आणि प्रकल्प, त्याचा टप्पा व तुमच्या भूखंडाची स्थिती पाहा.',
  'home.notices': 'प्राथमिक अधिसूचना, घोषणा आणि मंजूर पुनर्वसन योजना प्रसिद्ध होताच वाचा.',
  'home.myLand': 'जिल्हाधिकारी कार्यालयाने पाठवलेल्या लिंकने तुमचे पुनर्वसन पासबुक उघडा किंवा रक्कम मिळाल्याची पुष्टी करा.',
  'home.grievance': 'हरकत घेण्याचा, न मिळालेल्या रकमेची माहिती देण्याचा किंवा कार्यालयाशी संपर्काचा योग्य मार्ग शोधा.',

  'search.title': 'माझी जमीन शोधा',
  'search.intro': 'तुमचे गाव निवडा, आणि माहीत असल्यास सर्व्हे नंबर टाका.',
  'search.village': 'गाव',
  'search.villagePlaceholder': 'गावाच्या नावाची किमान 2 अक्षरे लिहा',
  'search.villageNone': 'कोणतेही गाव जुळले नाही. स्पेलिंग तपासा किंवा नाव इंग्रजीत लिहून पाहा.',
  'search.villageChosen': 'निवडलेले: {village}',
  'search.villageChange': 'गाव बदला',
  'search.survey': 'सर्व्हे नंबर (ऐच्छिक)',
  'search.surveyHint': 'उदा. 112 किंवा 112/2',
  'search.submit': 'शोधा',
  'search.needVillage': 'आधी यादीतून गाव निवडा.',
  'search.count': '{n} नोंदी सापडल्या',
  'search.empty':
    'या गावासाठी आणि सर्व्हे नंबरसाठी भूसंपादनाची कोणतीही नोंद सापडली नाही. तुम्हाला सूचना मिळाली असल्यास जिल्हाधिकारी कार्यालयाशी संपर्क साधा.',

  'parcel.survey': 'सर्व्हे नं.',
  'parcel.project': 'प्रकल्प',
  'parcel.stage': 'सध्याचा टप्पा',
  'parcel.status': 'भूखंडाची स्थिती',
  'parcel.projectStatus': 'प्रकल्पाची स्थिती',
  'parcel.affected': 'भूखंडाचा बाधित भाग',
  'parcel.frozen': 'जमीन हस्तांतरण रोखले',
  'parcel.lastNotice': 'शेवटची सार्वजनिक सूचना',
  'parcel.contact': 'संपर्क',
  'parcel.contactValue': 'जिल्हाधिकारी कार्यालय, {district} जिल्हा',
  'parcel.notices': 'या प्रकल्पाच्या सूचना पाहा',
  'parcel.object': 'हरकत नोंदवा',

  'notices.title': 'प्रसिद्ध सूचना',
  'notices.intro': 'प्रत्येक प्रकल्पासाठी प्रसिद्ध झालेल्या अधिसूचना, घोषणा आणि पुनर्वसन योजना.',
  'notices.filter': 'प्रकल्प कोड',
  'notices.filterHint': 'प्रकल्प कोड तुमच्या भूखंड शोध निकालात दिसतो.',
  'notices.apply': 'सूचना दाखवा',
  'notices.clear': 'सर्व प्रकल्प दाखवा',
  'notices.empty': 'कोणतीही प्रसिद्ध सूचना सापडली नाही.',
  'notices.type': 'सूचना',
  'notices.docTitle': 'शीर्षक',
  'notices.published': 'प्रसिद्धी',
  'notices.language': 'भाषा',
  'notices.fingerprint': 'दस्तऐवज फिंगरप्रिंट',
  'notices.copy':
    'सूचनेच्या प्रतीसाठी जिल्हाधिकारी कार्यालयात जा. फिंगरप्रिंटमुळे (SHA-256) कोणीही तपासू शकतो की प्रत प्रसिद्ध दस्तऐवजाशी जुळते.',

  'objection.title': 'हरकत नोंदवा',
  'objection.intro':
    'प्राथमिक अधिसूचनेनंतर (2013 च्या कायद्याचे कलम 15), जमिनीत हितसंबंध असलेली कोणतीही व्यक्ती हरकत कालावधी सुरू असेपर्यंत हरकत घेऊ शकते. प्रत्येक हरकतीची सुनावणी जिल्हाधिकारी घेतात.',
  'objection.prefill': 'सूचना: “माझी जमीन शोधा” पासून सुरुवात करा. तिथे भूखंड निवडल्यास पहिली तीन रकाने आपोआप भरतात.',
  'objection.project': 'प्रकल्प कोड',
  'objection.village': 'गाव कोड',
  'objection.survey': 'सर्व्हे नंबर',
  'objection.surveyHint': 'शोध निकालात दिसतो तसाच, उदा. 112/2',
  'objection.name': 'तुमचे नाव (ऐच्छिक)',
  'objection.body': 'तुमची हरकत',
  'objection.bodyHint':
    'कशावर आणि का हरकत आहे ते लिहा, उदा. घेतली जाणारी जमीन, सार्वजनिक प्रयोजन किंवा सामाजिक परिणामांचे निष्कर्ष. किमान 10 अक्षरे.',
  'objection.privacy': 'या फॉर्ममध्ये आधार, बँक खाते किंवा फोन नंबर लिहू नका.',
  'objection.demo': 'डेमो मोड: फक्त काल्पनिक माहिती भरा.',
  'objection.submit': 'हरकत पाठवा',
  'objection.submitting': 'पाठवत आहे…',
  'objection.rejected': 'हरकत स्वीकारली गेली नाही.',
  'objection.done': 'हरकत नोंदवली गेली',
  'objection.reference': 'तुमचा संदर्भ: {ref}',
  'objection.keepRef': 'हा संदर्भ जपून ठेवा. तुमच्या हरकतीबद्दल जिल्हाधिकारी कार्यालयाशी संपर्क करताना तो सांगा.',
  'objection.another': 'आणखी एक हरकत नोंदवा',
  'objection.tooShort': 'किमान 10 अक्षरे लिहा.',

  'myLand.title': 'माझी जमीन व मोबदला',
  'myLand.intro':
    'खाते किंवा पासवर्ड तयार करण्याची गरज नाही. जिल्हाधिकारी कार्यालय तुम्हाला SMS ने किंवा शिबिरात QR कोडद्वारे सुरक्षित लिंक पाठवते. प्रत्येक लिंक तुमच्यासाठी एक काम उघडते.',
  'myLand.parcelTitle': 'माझी जमीन संपादित होत आहे का?',
  'myLand.parcelDesc': 'गाव आणि सर्व्हे नंबरने शोधा. कोणतीही वैयक्तिक माहिती देण्याची गरज नाही.',
  'myLand.parcelAction': 'माझी जमीन शोधा',
  'myLand.passbookTitle': 'माझे पुनर्वसन पासबुक',
  'myLand.passbookDesc':
    'तुमच्या कुटुंबाला काय मिळणार, किती रक्कम मिळाली, किती बाकी आहे आणि तुमचे पुनर्वसन स्थळ पाहा. तुम्हाला पाठवलेली पासबुक लिंक वापरा.',
  'myLand.ackTitle': 'रक्कम मिळाल्याची पुष्टी करा',
  'myLand.ackDesc':
    'रक्कम दिल्यानंतर ती मिळाल्याची पुष्टी करण्यासाठी तुम्हाला लिंक मिळते. त्याच पानावर रक्कम मिळाली नाही असेही सांगता येते.',
  'myLand.linkLabel': 'तुमची लिंक किंवा कोड चिकटवा',
  'myLand.linkPlaceholder': 'SMS मधील पूर्ण लिंक चिकटवा',
  'myLand.open': 'उघडा',
  'myLand.badLink': 'ही वैध लिंक वाटत नाही. मिळाली तशीच पूर्ण लिंक चिकटवा.',
  'myLand.noLink': 'लिंक नाही? जिल्हाधिकारी कार्यालय किंवा पुनर्वसन प्रशासकांना लिंक पाठवण्यास सांगा.',
  'myLand.privacyTitle': 'तुमची गोपनीयता',
  'myLand.privacyBody':
    'हे पोर्टल कधीही आधार मागत नाही. तुम्ही फिंगरप्रिंट किंवा चेहऱ्याने पुष्टी केल्यास तपासणी फक्त तुमच्या स्वतःच्या फोनवर होते. फिंगरप्रिंट किंवा त्याची प्रतिमा पाठवली जात नाही आणि साठवली जात नाही.',

  'grievance.title': 'तक्रारी व मदत',
  'grievance.intro':
    'खाली तक्रार नोंदवा आणि ट्रॅकिंग क्रमांकाने तिची स्थिती पाहा, किंवा खाली दिलेल्या कायदेशीर मार्गांपैकी एक वापरा.',
  'grievance.objectionTitle': 'माझ्या जमिनीच्या संपादनावर माझी हरकत आहे',
  'grievance.objectionDesc':
    'हरकतींची सुनावणी जिल्हाधिकारी घेतात, पण फक्त प्राथमिक अधिसूचनेनंतरचा हरकत कालावधी सुरू असेपर्यंत.',
  'grievance.objectionAction': 'हरकत नोंदवा',
  'grievance.disputeTitle': 'रक्कम दिली असे दिसते, पण मला मिळाली नाही',
  'grievance.disputeDesc':
    'तुम्हाला पाठवलेली रक्कम लिंक उघडा आणि “मला ही रक्कम मिळाली नाही” निवडा. ही रक्कम जिल्हाधिकाऱ्यांच्या निदर्शनास आणली जाते.',
  'grievance.disputeAction': 'माझी रक्कम लिंक उघडा',
  'grievance.passbookTitle': 'मला काय मिळणार किंवा काय बाकी आहे ते जाणून घ्यायचे आहे',
  'grievance.passbookDesc': 'तुमचे पुनर्वसन पासबुक प्रत्येक हक्क, मिळालेली रक्कम आणि बाकी रक्कम दाखवते.',
  'grievance.passbookAction': 'माझे पासबुक उघडा',
  'grievance.collectorTitle': 'इतर काही',
  'grievance.collectorDesc':
    'नोंदीत चुकीचे नाव किंवा क्षेत्र, मोबदल्याचा दावा, पुनर्वसन स्थळावरील अडचणी, किंवा हरकत कालावधी संपल्यानंतरची हरकत यासाठी तुमच्या जिल्ह्याच्या जिल्हाधिकारी कार्यालयाशी संपर्क साधा. तुमचा जिल्हा भूखंड शोध निकालात दिसतो.',
  'grievance.collectorAction': 'माझा जिल्हा शोधा',
  'grievance.keepRef': 'मिळालेला कोणताही संदर्भ क्रमांक जपून ठेवा आणि कार्यालयाशी संपर्क करताना सांगा.',

  'stage.S01_PROPOSAL': 'प्रस्ताव',
  'stage.S02_SIA': 'सामाजिक परिणाम मूल्यांकन',
  'stage.S03_APPRAISAL': 'तज्ज्ञ मूल्यमापन',
  'stage.S04_CONSENT': 'संमती',
  'stage.S05_NOTIFICATION': 'प्राथमिक अधिसूचना व हरकती',
  'stage.S06_RNR_SCHEME': 'पुनर्वसन योजना',
  'stage.S07_DECLARATION': 'घोषणा',
  'stage.S08_AWARD': 'निवाडा',
  'stage.S09_PAYMENT_POSSESSION': 'मोबदला व ताबा',
  'stage.S10_POST_ACQUISITION': 'संपादनानंतर',

  'parcelStatus.PROPOSED': 'प्रस्तावित',
  'parcelStatus.VERIFICATION_PENDING': 'पडताळणी प्रलंबित',
  'parcelStatus.VERIFIED': 'पडताळलेले',
  'parcelStatus.CONSENT_ACQUIRED_NOTIFIED': 'अधिसूचित',
  'parcelStatus.CLEARED_FOR_AWARD_RNR': 'निवाड्यासाठी मंजूर',
  'parcelStatus.AWARDED': 'निवाडा झाला',
  'parcelStatus.READY_FOR_POSSESSION': 'ताब्यासाठी तयार',
  'parcelStatus.ACQUIRED_POSSESSED': 'संपादित',
  'parcelStatus.CLOSED': 'बंद',
  'parcelStatus.DENOTIFIED': 'मुक्त (अधिसूचना रद्द)',
  'parcelStatus.TERMINATED': 'वगळले',

  'projectStatus.SUBMITTED': 'सादर',
  'projectStatus.ACTIVE': 'सक्रिय',
  'projectStatus.ON_HOLD': 'स्थगित',
  'projectStatus.TERMINATED': 'समाप्त',
  'projectStatus.DENOTIFIED': 'अधिसूचना रद्द',
  'projectStatus.ABANDONED': 'सोडून दिलेला',
  'projectStatus.LAPSED': 'व्यपगत',
  'projectStatus.CLOSED': 'बंद',

  'docType.S11_NOTIFICATION': 'प्राथमिक अधिसूचना (कलम 11)',
  'docType.S19_DECLARATION': 'घोषणा (कलम 19)',
  'docType.RNR_SCHEME_APPROVED': 'मंजूर पुनर्वसन योजना',
  'docType.GAZETTE_COPY': 'राजपत्र प्रत',
  'docType.DENOTIFICATION_ORDER': 'अधिसूचना रद्द करण्याचा आदेश',
};

const TABLES: Record<Lang, Messages> = { en, hi, mr };

export function messages(lang: Lang): Messages {
  return TABLES[lang];
}

/** Replaces {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Label for an enum code (stage, parcel status, …); unknown codes are shown as they are. */
export function codeLabel(lang: Lang, group: 'stage' | 'parcelStatus' | 'projectStatus' | 'docType', code: string | null): string {
  if (!code) return TABLES[lang]['common.dash'];
  const key = `${group}.${code}`;
  const table = TABLES[lang] as Record<string, string>;
  const fallback = TABLES.en as Record<string, string>;
  return table[key] ?? fallback[key] ?? code;
}
