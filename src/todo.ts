import { Annotation, Entity, EntityType, EntityClass, Input } from './types/input';
import { ConvertedAnnotation, ConvertedEntity, Output } from './types/output';
import * as yup from 'yup';

// TODO: Convert Input to the Output structure. Do this in an efficient and generic way.
// HINT: Make use of the helper library "lodash"
export const convertInput = (input: Input): Output => {
  const documents = input.documents.map((document) => {
    // TODO: map the entities to the new structure and sort them based on the property "name"
    // Make sure the nested children are also mapped and sorted
    const documentEntities = document.entities;
    const entities = documentEntities.map(convertEntity(documentEntities)).sort(sortEntities);

    // TODO: map the annotations to the new structure and sort them based on the property "index"
    // Make sure the nested children are also mapped and sorted
    const documentAnnotations = document.annotations;
    const annotations = documentAnnotations
      .filter(filterAnnotations)
      .map(convertAnnotation(entities, documentAnnotations))
      .sort(sortAnnotations);

    return { id: document.id, entities, annotations };
  });

  return { documents };
};

// HINT: you probably need to pass extra argument(s) to this function to make it performant.
const convertEntity = (documentEntities: Entity[]) => (entity: Entity): ConvertedEntity => {
  const children = documentEntities
    .filter((e) => e.refs.includes(entity.id))
    .map(convertEntity(documentEntities))
    .sort(sortEntities);

  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    class: entity.class,
    children,
  }
};

const filterAnnotations = (annotation: Annotation) => !annotation.refs.length;

// HINT: you probably need to pass extra argument(s) to this function to make it performant.
const convertAnnotation = (entities: ConvertedEntity[], documentAnnotations: Annotation[]) => (annotation: Annotation): ConvertedAnnotation => {
  const foundEntity = entities.find((e) => e.id === annotation.entityId) as ConvertedEntity;

  const children = documentAnnotations
    .filter((e) => e.refs.includes(annotation.id))
    .map(convertAnnotation(entities, documentAnnotations))
    .sort(sortAnnotations);

  const getIndex = () => {
    if (annotation.indices && annotation.indices.length) {
      return annotation.indices[0].start;
    }

    if (children.length) {
      return children[0].index;
    }

    return -1;
  }

  return {
    id: annotation.id,
    entity: {
      id: foundEntity.id,
      name: foundEntity.name,
    },
    value: annotation.value,
    index: getIndex(),
    children,
  }
};

const sortElementsInAscendingOrder = (elementA: string | number, elementB: string | number): number => {
  if (elementA > elementB) {
    return 1;
  } else if (elementA < elementB) {
    return -1;
  } else {
    return 0;
  }
}

const sortEntities =
  (entityA: ConvertedEntity, entityB: ConvertedEntity): number =>
    sortElementsInAscendingOrder(entityA.name.toLowerCase(), entityB.name.toLowerCase());

const sortAnnotations =
  (annotationA: ConvertedAnnotation, annotationB: ConvertedAnnotation): number =>
    sortElementsInAscendingOrder(annotationA.index, annotationB.index);

// BONUS: Create validation function that validates the result of "convertInput". Use yup as library to validate your result.
export const validateOutput = (output: Output): boolean => {
  const entitySchema: yup.ObjectSchema<ConvertedEntity> = yup.object().shape({
    id: yup.string().required(),
    name: yup.string().required(),
    type: yup.string<EntityType>().required(),
    class: yup.string<EntityClass>().required(),
    children: yup.array().of(yup.lazy(() => entitySchema)).required(),
  });

  const annotationSchema: yup.ObjectSchema<ConvertedAnnotation> = yup.object().shape({
    id: yup.string().required(),
    entity: yup.object().shape({
      id: yup.string().required(),
      name: yup.string().required(),
    }).required(),
    value: yup.mixed<string | number>().required().nullable(),
    index: yup.number().required(),
    children: yup.array().of(yup.lazy(() => annotationSchema)).required(),
  });

  const outputSchema = yup.object().shape({
    documents: yup.array()
      .of(yup.object().shape({
        id: yup.string(),
        entities: yup.array().of(entitySchema),
        annotations: yup.array().of(annotationSchema),
      })),
  });

  return outputSchema.isValidSync(output);
}