import { faker } from '@faker-js/faker';

/**
 * Single-entry description and generator for one Postman-style dynamic variable.
 */
export interface DynamicVariableDefinition {
  /**
   * Human-readable summary shown in tooltips and autocomplete detail text.
   */
  description: string;

  /**
   * Produces a fresh value each time the variable is resolved.
   */
  generate: () => string;
}

/**
 * Returns a placeholder image URL for a lorempixel-style category.
 *
 * @param category - Image subject category.
 */
function categoryImageUrl(category: string): string {
  return faker.image.urlLoremFlickr({ category });
}

/**
 * Registry of Postman-compatible dynamic variables backed by faker or built-ins.
 * Keys include the leading `$` (e.g. `$guid`, `$randomFirstName`).
 */
export const DYNAMIC_VARIABLES: Record<string, DynamicVariableDefinition> = {
  // Common
  $guid: {
    description: 'A uuid-v4 style guid',
    generate: () => faker.string.uuid()
  },
  $timestamp: {
    description: 'The current UNIX timestamp in seconds',
    generate: () => String(Math.floor(Date.now() / 1000))
  },
  $isoTimestamp: {
    description: 'The current ISO timestamp at zero UTC',
    generate: () => new Date().toISOString()
  },
  $randomUUID: {
    description: 'A random 36-character UUID',
    generate: () => faker.string.uuid()
  },

  // Text, numbers, and colors
  $randomAlphaNumeric: {
    description: 'A random alpha-numeric character',
    generate: () => faker.string.alphanumeric(1)
  },
  $randomBoolean: {
    description: 'A random boolean value',
    generate: () => String(faker.datatype.boolean())
  },
  $randomInt: {
    description: 'A random integer between 0 and 1000',
    generate: () => String(faker.number.int({ min: 0, max: 1000 }))
  },
  $randomColor: {
    description: 'A random color name',
    generate: () => faker.color.human()
  },
  $randomHexColor: {
    description: 'A random hex color value',
    generate: () => faker.color.rgb({ format: 'hex' })
  },
  $randomAbbreviation: {
    description: 'A random abbreviation',
    generate: () => faker.hacker.abbreviation()
  },

  // Internet and IP addresses
  $randomIP: {
    description: 'A random IPv4 address',
    generate: () => faker.internet.ipv4()
  },
  $randomIPV6: {
    description: 'A random IPv6 address',
    generate: () => faker.internet.ipv6()
  },
  $randomMACAddress: {
    description: 'A random MAC address',
    generate: () => faker.internet.mac()
  },
  $randomPassword: {
    description: 'A random 15-character alpha-numeric password',
    generate: () => faker.internet.password({ length: 15 })
  },
  $randomLocale: {
    description: 'A random two-letter language code (ISO 639-1)',
    generate: () => faker.location.language().alpha2
  },
  $randomUserAgent: {
    description: 'A random user agent string',
    generate: () => faker.internet.userAgent()
  },
  $randomProtocol: {
    description: 'A random internet protocol',
    generate: () => faker.helpers.arrayElement(['http', 'https'])
  },
  $randomSemver: {
    description: 'A random semantic version number',
    generate: () => faker.system.semver()
  },

  // Names
  $randomFirstName: {
    description: 'A random first name',
    generate: () => faker.person.firstName()
  },
  $randomLastName: {
    description: 'A random last name',
    generate: () => faker.person.lastName()
  },
  $randomFullName: {
    description: 'A random first and last name',
    generate: () => faker.person.fullName()
  },
  $randomNamePrefix: {
    description: 'A random name prefix',
    generate: () => faker.person.prefix()
  },
  $randomNameSuffix: {
    description: 'A random name suffix',
    generate: () => faker.person.suffix()
  },

  // Profession
  $randomJobArea: {
    description: 'A random job area',
    generate: () => faker.person.jobArea()
  },
  $randomJobDescriptor: {
    description: 'A random job descriptor',
    generate: () => faker.person.jobDescriptor()
  },
  $randomJobTitle: {
    description: 'A random job title',
    generate: () => faker.person.jobTitle()
  },
  $randomJobType: {
    description: 'A random job type',
    generate: () => faker.person.jobType()
  },

  // Phone, address, and location
  $randomPhoneNumber: {
    description: 'A random ten-digit phone number',
    generate: () => faker.phone.number({ style: 'national' })
  },
  $randomPhoneNumberExt: {
    description: 'A random phone number with extension',
    generate: () => `${faker.phone.number()} x${faker.string.numeric(4)}`
  },
  $randomCity: {
    description: 'A random city name',
    generate: () => faker.location.city()
  },
  $randomStreetName: {
    description: 'A random street name',
    generate: () => faker.location.street()
  },
  $randomStreetAddress: {
    description: 'A random street address',
    generate: () => faker.location.streetAddress()
  },
  $randomCountry: {
    description: 'A random country name',
    generate: () => faker.location.country()
  },
  $randomCountryCode: {
    description: 'A random two-letter country code (ISO 3166-1 alpha-2)',
    generate: () => faker.location.countryCode()
  },
  $randomLatitude: {
    description: 'A random latitude coordinate',
    generate: () => String(faker.location.latitude())
  },
  $randomLongitude: {
    description: 'A random longitude coordinate',
    generate: () => String(faker.location.longitude())
  },

  // Images
  $randomAvatarImage: {
    description: 'A random avatar image URL',
    generate: () => faker.image.avatar()
  },
  $randomImageUrl: {
    description: 'A URL of a random image',
    generate: () => faker.image.url()
  },
  $randomAbstractImage: {
    description: 'A URL of a random abstract image',
    generate: () => categoryImageUrl('abstract')
  },
  $randomAnimalsImage: {
    description: 'A URL of a random animal image',
    generate: () => categoryImageUrl('animals')
  },
  $randomBusinessImage: {
    description: 'A URL of a random stock business image',
    generate: () => categoryImageUrl('business')
  },
  $randomCatsImage: {
    description: 'A URL of a random cat image',
    generate: () => categoryImageUrl('cats')
  },
  $randomCityImage: {
    description: 'A URL of a random city image',
    generate: () => categoryImageUrl('city')
  },
  $randomFoodImage: {
    description: 'A URL of a random food image',
    generate: () => categoryImageUrl('food')
  },
  $randomNightlifeImage: {
    description: 'A URL of a random nightlife image',
    generate: () => categoryImageUrl('nightlife')
  },
  $randomFashionImage: {
    description: 'A URL of a random fashion image',
    generate: () => categoryImageUrl('fashion')
  },
  $randomPeopleImage: {
    description: 'A URL of a random image of a person',
    generate: () => categoryImageUrl('people')
  },
  $randomNatureImage: {
    description: 'A URL of a random nature image',
    generate: () => categoryImageUrl('nature')
  },
  $randomSportsImage: {
    description: 'A URL of a random sports image',
    generate: () => categoryImageUrl('sports')
  },
  $randomTransportImage: {
    description: 'A URL of a random transportation image',
    generate: () => categoryImageUrl('transport')
  },
  $randomImageDataUri: {
    description: 'A random image data URI',
    generate: () => faker.image.dataUri()
  },

  // Finance
  $randomBankAccount: {
    description: 'A random 8-digit bank account number',
    generate: () => faker.finance.accountNumber(8)
  },
  $randomBankAccountName: {
    description: 'A random bank account name',
    generate: () => faker.finance.accountName()
  },
  $randomCreditCardMask: {
    description: 'A random masked credit card number (last four digits)',
    generate: () => faker.finance.creditCardNumber().slice(-4)
  },
  $randomBankAccountBic: {
    description: 'A random BIC (Bank Identifier Code)',
    generate: () => faker.finance.bic()
  },
  $randomBankAccountIban: {
    description: 'A random IBAN (International Bank Account Number)',
    generate: () => faker.finance.iban()
  },
  $randomTransactionType: {
    description: 'A random transaction type',
    generate: () => faker.helpers.arrayElement(['invoice', 'payment', 'deposit'])
  },
  $randomCurrencyCode: {
    description: 'A random 3-letter currency code (ISO-4217)',
    generate: () => faker.finance.currencyCode()
  },
  $randomCurrencyName: {
    description: 'A random currency name',
    generate: () => faker.finance.currencyName()
  },
  $randomCurrencySymbol: {
    description: 'A random currency symbol',
    generate: () => faker.finance.currencySymbol()
  },
  $randomBitcoin: {
    description: 'A random bitcoin address',
    generate: () => faker.finance.bitcoinAddress()
  },

  // Business
  $randomCompanyName: {
    description: 'A random company name',
    generate: () => faker.company.name()
  },
  $randomCompanySuffix: {
    description: 'A random company suffix',
    generate: () => faker.helpers.arrayElement(['Inc', 'LLC', 'Group', 'Ltd', 'Corp'])
  },
  $randomBs: {
    description: 'A random phrase of business-speak',
    generate: () => faker.company.catchPhrase()
  },
  $randomBsAdjective: {
    description: 'A random business-speak adjective',
    generate: () => faker.company.buzzAdjective()
  },
  $randomBsBuzz: {
    description: 'A random business-speak buzzword',
    generate: () => faker.company.buzzVerb()
  },
  $randomBsNoun: {
    description: 'A random business-speak noun',
    generate: () => faker.company.buzzNoun()
  },

  // Catchphrases
  $randomCatchPhrase: {
    description: 'A random catchphrase',
    generate: () => faker.company.catchPhrase()
  },
  $randomCatchPhraseAdjective: {
    description: 'A random catchphrase adjective',
    generate: () => faker.company.catchPhraseAdjective()
  },
  $randomCatchPhraseDescriptor: {
    description: 'A random catchphrase descriptor',
    generate: () => faker.company.catchPhraseDescriptor()
  },
  $randomCatchPhraseNoun: {
    description: 'A random catchphrase noun',
    generate: () => faker.company.catchPhraseNoun()
  },

  // Databases
  $randomDatabaseColumn: {
    description: 'A random database column name',
    generate: () => faker.database.column()
  },
  $randomDatabaseType: {
    description: 'A random database type',
    generate: () => faker.database.type()
  },
  $randomDatabaseCollation: {
    description: 'A random database collation',
    generate: () => faker.database.collation()
  },
  $randomDatabaseEngine: {
    description: 'A random database engine',
    generate: () => faker.database.engine()
  },

  // Dates
  $randomDateFuture: {
    description: 'A random future datetime',
    generate: () => faker.date.future().toString()
  },
  $randomDatePast: {
    description: 'A random past datetime',
    generate: () => faker.date.past().toString()
  },
  $randomDateRecent: {
    description: 'A random recent datetime',
    generate: () => faker.date.recent().toString()
  },
  $randomWeekday: {
    description: 'A random weekday name',
    generate: () => faker.date.weekday()
  },
  $randomMonth: {
    description: 'A random month name',
    generate: () => faker.date.month()
  },

  // Domains, emails, and usernames
  $randomDomainName: {
    description: 'A random domain name',
    generate: () => faker.internet.domainName()
  },
  $randomDomainSuffix: {
    description: 'A random domain suffix',
    generate: () => faker.internet.domainSuffix()
  },
  $randomDomainWord: {
    description: 'A random unqualified domain name',
    generate: () => faker.internet.domainWord()
  },
  $randomEmail: {
    description: 'A random email address',
    generate: () => faker.internet.email()
  },
  $randomExampleEmail: {
    description: 'A random email address from an example domain',
    generate: () => faker.internet.exampleEmail()
  },
  $randomUserName: {
    description: 'A random username',
    generate: () => faker.internet.username()
  },
  $randomUrl: {
    description: 'A random URL',
    generate: () => faker.internet.url()
  },

  // Files and directories
  $randomFileName: {
    description: 'A random file name',
    generate: () => faker.system.fileName()
  },
  $randomFileType: {
    description: 'A random file type',
    generate: () => faker.system.fileType()
  },
  $randomFileExt: {
    description: 'A random file extension',
    generate: () => faker.system.fileExt()
  },
  $randomCommonFileName: {
    description: 'A random common file name',
    generate: () => faker.system.commonFileName()
  },
  $randomCommonFileType: {
    description: 'A random common file type',
    generate: () => faker.system.commonFileType()
  },
  $randomCommonFileExt: {
    description: 'A random common file extension',
    generate: () => faker.system.commonFileExt()
  },
  $randomFilePath: {
    description: 'A random file path',
    generate: () => faker.system.filePath()
  },
  $randomDirectoryPath: {
    description: 'A random directory path',
    generate: () => faker.system.directoryPath()
  },
  $randomMimeType: {
    description: 'A random MIME type',
    generate: () => faker.system.mimeType()
  },

  // Stores
  $randomPrice: {
    description: 'A random price between 0.00 and 1000.00',
    generate: () => faker.commerce.price({ min: 0, max: 1000 })
  },
  $randomProduct: {
    description: 'A random product name',
    generate: () => faker.commerce.product()
  },
  $randomProductAdjective: {
    description: 'A random product adjective',
    generate: () => faker.commerce.productAdjective()
  },
  $randomProductMaterial: {
    description: 'A random product material',
    generate: () => faker.commerce.productMaterial()
  },
  $randomProductName: {
    description: 'A random product name with adjective and material',
    generate: () => faker.commerce.productName()
  },
  $randomDepartment: {
    description: 'A random commerce category',
    generate: () => faker.commerce.department()
  },

  // Grammar
  $randomNoun: {
    description: 'A random noun',
    generate: () => faker.word.noun()
  },
  $randomVerb: {
    description: 'A random verb',
    generate: () => faker.word.verb()
  },
  $randomIngverb: {
    description: 'A random verb ending in -ing',
    generate: () => `${faker.word.verb()}ing`
  },
  $randomAdjective: {
    description: 'A random adjective',
    generate: () => faker.word.adjective()
  },
  $randomWord: {
    description: 'A random word',
    generate: () => faker.word.sample()
  },
  $randomWords: {
    description: 'Some random words',
    generate: () => faker.word.words()
  },
  $randomPhrase: {
    description: 'A random phrase',
    generate: () => faker.lorem.sentence()
  },

  // Lorem ipsum
  $randomLoremWord: {
    description: 'A random word of lorem ipsum text',
    generate: () => faker.lorem.word()
  },
  $randomLoremWords: {
    description: 'Some random words of lorem ipsum text',
    generate: () => faker.lorem.words()
  },
  $randomLoremSentence: {
    description: 'A random sentence of lorem ipsum text',
    generate: () => faker.lorem.sentence()
  },
  $randomLoremSentences: {
    description: 'A random 2 to 6 sentences of lorem ipsum text',
    generate: () => faker.lorem.sentences({ min: 2, max: 6 })
  },
  $randomLoremParagraph: {
    description: 'A random paragraph of lorem ipsum text',
    generate: () => faker.lorem.paragraph()
  },
  $randomLoremParagraphs: {
    description: 'Three random paragraphs of lorem ipsum text',
    generate: () => faker.lorem.paragraphs(3)
  },
  $randomLoremText: {
    description: 'A random amount of lorem ipsum text',
    generate: () => faker.lorem.text()
  },
  $randomLoremSlug: {
    description: 'A random lorem ipsum URL slug',
    generate: () => faker.lorem.slug()
  },
  $randomLoremLines: {
    description: '1 to 5 random lines of lorem ipsum text',
    generate: () => faker.lorem.lines({ min: 1, max: 5 })
  }
};

/**
 * Documentation grouping for dynamic variables, aligned with Postman's reference sections.
 */
export const DYNAMIC_VARIABLE_CATEGORIES: ReadonlyArray<{
  title: string;
  keys: readonly string[];
}> = [
  {
    title: 'Common',
    keys: ['$guid', '$timestamp', '$isoTimestamp', '$randomUUID']
  },
  {
    title: 'Text, numbers, and colors',
    keys: [
      '$randomAlphaNumeric',
      '$randomBoolean',
      '$randomInt',
      '$randomColor',
      '$randomHexColor',
      '$randomAbbreviation'
    ]
  },
  {
    title: 'Internet and IP addresses',
    keys: [
      '$randomIP',
      '$randomIPV6',
      '$randomMACAddress',
      '$randomPassword',
      '$randomLocale',
      '$randomUserAgent',
      '$randomProtocol',
      '$randomSemver'
    ]
  },
  {
    title: 'Names',
    keys: [
      '$randomFirstName',
      '$randomLastName',
      '$randomFullName',
      '$randomNamePrefix',
      '$randomNameSuffix'
    ]
  },
  {
    title: 'Profession',
    keys: ['$randomJobArea', '$randomJobDescriptor', '$randomJobTitle', '$randomJobType']
  },
  {
    title: 'Phone, address, and location',
    keys: [
      '$randomPhoneNumber',
      '$randomPhoneNumberExt',
      '$randomCity',
      '$randomStreetName',
      '$randomStreetAddress',
      '$randomCountry',
      '$randomCountryCode',
      '$randomLatitude',
      '$randomLongitude'
    ]
  },
  {
    title: 'Images',
    keys: [
      '$randomAvatarImage',
      '$randomImageUrl',
      '$randomAbstractImage',
      '$randomAnimalsImage',
      '$randomBusinessImage',
      '$randomCatsImage',
      '$randomCityImage',
      '$randomFoodImage',
      '$randomNightlifeImage',
      '$randomFashionImage',
      '$randomPeopleImage',
      '$randomNatureImage',
      '$randomSportsImage',
      '$randomTransportImage',
      '$randomImageDataUri'
    ]
  },
  {
    title: 'Finance',
    keys: [
      '$randomBankAccount',
      '$randomBankAccountName',
      '$randomCreditCardMask',
      '$randomBankAccountBic',
      '$randomBankAccountIban',
      '$randomTransactionType',
      '$randomCurrencyCode',
      '$randomCurrencyName',
      '$randomCurrencySymbol',
      '$randomBitcoin'
    ]
  },
  {
    title: 'Business',
    keys: [
      '$randomCompanyName',
      '$randomCompanySuffix',
      '$randomBs',
      '$randomBsAdjective',
      '$randomBsBuzz',
      '$randomBsNoun'
    ]
  },
  {
    title: 'Catchphrases',
    keys: [
      '$randomCatchPhrase',
      '$randomCatchPhraseAdjective',
      '$randomCatchPhraseDescriptor',
      '$randomCatchPhraseNoun'
    ]
  },
  {
    title: 'Databases',
    keys: [
      '$randomDatabaseColumn',
      '$randomDatabaseType',
      '$randomDatabaseCollation',
      '$randomDatabaseEngine'
    ]
  },
  {
    title: 'Dates',
    keys: [
      '$randomDateFuture',
      '$randomDatePast',
      '$randomDateRecent',
      '$randomWeekday',
      '$randomMonth'
    ]
  },
  {
    title: 'Domains, emails, and usernames',
    keys: [
      '$randomDomainName',
      '$randomDomainSuffix',
      '$randomDomainWord',
      '$randomEmail',
      '$randomExampleEmail',
      '$randomUserName',
      '$randomUrl'
    ]
  },
  {
    title: 'Files and directories',
    keys: [
      '$randomFileName',
      '$randomFileType',
      '$randomFileExt',
      '$randomCommonFileName',
      '$randomCommonFileType',
      '$randomCommonFileExt',
      '$randomFilePath',
      '$randomDirectoryPath',
      '$randomMimeType'
    ]
  },
  {
    title: 'Stores',
    keys: [
      '$randomPrice',
      '$randomProduct',
      '$randomProductAdjective',
      '$randomProductMaterial',
      '$randomProductName',
      '$randomDepartment'
    ]
  },
  {
    title: 'Grammar',
    keys: [
      '$randomNoun',
      '$randomVerb',
      '$randomIngverb',
      '$randomAdjective',
      '$randomWord',
      '$randomWords',
      '$randomPhrase'
    ]
  },
  {
    title: 'Lorem ipsum',
    keys: [
      '$randomLoremWord',
      '$randomLoremWords',
      '$randomLoremSentence',
      '$randomLoremSentences',
      '$randomLoremParagraph',
      '$randomLoremParagraphs',
      '$randomLoremText',
      '$randomLoremSlug',
      '$randomLoremLines'
    ]
  }
];

/**
 * Returns whether a variable key is a known dynamic variable name.
 *
 * @param key - Token name from inside `{{...}}` braces.
 */
export function isDynamicVariable(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(DYNAMIC_VARIABLES, key);
}

/**
 * Returns the description for a dynamic variable, if defined.
 *
 * @param key - Token name from inside `{{...}}` braces.
 */
export function getDynamicVariableDescription(key: string): string | undefined {
  return DYNAMIC_VARIABLES[key]?.description;
}

/**
 * Generates a fresh value for a dynamic variable key.
 *
 * @param key - Token name from inside `{{...}}` braces (e.g. `$guid`).
 * @returns Generated string, or undefined when the key is not a dynamic variable.
 */
export function resolveDynamicVariable(key: string): string | undefined {
  const definition = DYNAMIC_VARIABLES[key];
  if (!definition) {
    return undefined;
  }
  return definition.generate();
}

/**
 * Sorted list of dynamic variable names for autocomplete and documentation.
 */
export const DYNAMIC_VARIABLE_NAMES = Object.keys(DYNAMIC_VARIABLES).sort();
