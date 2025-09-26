import { getAccessToken } from './auth.js';
import { submitDDS, retrieveDDS, retractDDS } from './tracesClient.js';

async function main() {
  const token = await getAccessToken();

  const payload = {
    operatorType: 'TRADER',
    activityType: 'TRADE',
    countryOfActivity: 'IT',
    commodities: [
      {
        hsHeading: '4901',
        descriptors: {
          descriptionOfGoods: 'Libri',
          goodsMeasure: { units: 'PCS' }
        }
      }
    ],
    operator: {
      nameAndAddress: { name: 'EMMELIBRI', country: 'IT', address: 'Milano' },
      email: 'pino.omodei@meli.it'
    },
    associatedStatements: [{ referenceNumber: '25NLSN6LX69730', verificationNumber: 'K7R8LA90' }],
    internalReferenceNumber: 'POC-0001'
  };

  const submission = await submitDDS(token, payload);
  console.log('Submitted:', submission);

  const ref = submission.referenceNumber;
  const retrieved = await retrieveDDS(token, ref);
  console.log('Retrieved:', retrieved);

  const retracted = await retractDDS(token, ref);
  console.log('Retracted:', retracted);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
