import type { VisualSpec } from '../../../types/visualSpec';
import { isOwner } from '../../builderEdits';
import { readGraph, type GraphModel } from '../graph/graphModel';

const DEVICE_PREFIX = 'network/';
// A subnet is a frame around devices and a packet is a token, so neither is a place a packet can be.
const NOT_DEVICES = ['network/subnet', 'network/packet'];

export const CLIENT_REF = 'network/client';
export const SERVER_REF = 'network/server';

const isDevice = (el: VisualSpec['elements'][number]): boolean =>
  isOwner(el) && el.builder?.fx !== true && el.builder?.say !== true && (el.builder?.pack?.startsWith(DEVICE_PREFIX) ?? false) && !NOT_DEVICES.includes(el.builder?.pack ?? '');

export interface NetworkModel {
  graph: GraphModel;
  packOf: (device: string) => string;
}

// Reads the drawing as a network: devices are the objects of the network pack, links are cables (a cable with no arrow runs both ways).
export function readNetwork(spec: VisualSpec): NetworkModel {
  const graph = readGraph(spec, isDevice);
  const packs = new Map(spec.elements.filter(isDevice).map((el) => [el.id, el.builder?.pack ?? '']));
  return { graph, packOf: (device) => packs.get(device) ?? '' };
}
