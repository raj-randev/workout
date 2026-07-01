export const schema = {
  version: 1,
  models: {
    AppDataRecord: {
      name: 'AppDataRecord',
      attributes: [{ type: 'model' }],
      fields: {
        id: { type: 'ID', isRequired: true },
        payload: { type: 'String', isRequired: true },
      },
    },
  },
};
