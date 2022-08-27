import { mockProgram } from "@symbolism/test";
import { findIdentifiers } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { evaluateSchema } from "../schema";
import { SchemaContext } from "../context";
import { LogLevel, setLogLevel } from "@symbolism/utils";

function testType(source: string, name = "Type") {
  const program = mockProgram({
    "test.ts": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findIdentifiers(sourceFile, name)[0];
  return {
    type: checker.getTypeAtLocation(node),
    declaration: node,
    program,
    sourceFile,
    checker,

    context: new SchemaContext(node, checker, {}),
  };
}

describe("type schema converter", () => {
  describe("DOM types", () => {
    describe("ReadableStream", () => {
      it("should load ReadableStream generic", () => {
        // setLogLevel(LogLevel.debug);
        const { checker, sourceFile } = testType(`
          declare const stream: ReadableStream<string>;
        `);

        expect(testNode("stream")).toMatchInlineSnapshot(`
          "type AbortSignal = {
            aborted: false | true;
            addEventListener:
              | ((
                  type: String,
                  listener: (ev: AbortSignalEventMap[String]) => any,
                  options: AddEventListenerOptions | false | true
                ) => undefined)
              | ((
                  type: string,
                  listener: EventListenerOrEventListenerObject,
                  options: AddEventListenerOptions | false | true
                ) => undefined);
            dispatchEvent: (event: Event) => false | true;
            onabort: (ev: Event) => any;
            reason: any;
            removeEventListener:
              | ((
                  type: String,
                  listener: (ev: AbortSignalEventMap[String]) => any,
                  options: EventListenerOptions | false | true
                ) => undefined)
              | ((
                  type: string,
                  listener: EventListenerOrEventListenerObject,
                  options: EventListenerOptions | false | true
                ) => undefined);
            throwIfAborted: () => undefined;
          };

          type AbortSignalEventMap = { abort: Event };

          type AddEventListenerOptions = {
            capture: false | true;
            once: false | true;
            passive: false | true;
            signal: AbortSignal;
          };

          type Event = {
            AT_TARGET: number;
            BUBBLING_PHASE: number;
            CAPTURING_PHASE: number;
            NONE: number;
            bubbles: false | true;
            cancelBubble: false | true;
            cancelable: false | true;
            composed: false | true;
            composedPath: () => EventTarget[];
            currentTarget: EventTarget;
            defaultPrevented: false | true;
            eventPhase: number;
            initEvent: (
              type: string,
              bubbles: false | true,
              cancelable: false | true
            ) => undefined;
            isTrusted: false | true;
            preventDefault: () => undefined;
            returnValue: false | true;
            srcElement: EventTarget;
            stopImmediatePropagation: () => undefined;
            stopPropagation: () => undefined;
            target: EventTarget;
            timeStamp: number;
            type: string;
          };

          type EventListener = (evt: Event) => undefined;

          type EventListenerObject = { handleEvent: (object: Event) => undefined };

          type EventListenerOptions = { capture: false | true };

          type EventListenerOrEventListenerObject = EventListener | EventListenerObject;

          type EventTarget = {
            addEventListener: (
              type: string,
              callback: EventListener | EventListenerObject,
              options: AddEventListenerOptions | false | true
            ) => undefined;
            dispatchEvent: (event: Event) => false | true;
            removeEventListener: (
              type: string,
              callback: EventListenerOrEventListenerObject,
              options: EventListenerOptions | false | true
            ) => undefined;
          };

          type ReadableStream<T> = {
            cancel: (reason: any) => Promise<undefined>;
            getReader: () => ReadableStreamDefaultReader<{}>;
            locked: false | true;
            pipeThrough: (
              transform: ReadableWritablePair<{}, {}>,
              options: StreamPipeOptions
            ) => ReadableStream<{}>;
            pipeTo: (
              destination: WritableStream<{}>,
              options: StreamPipeOptions
            ) => Promise<undefined>;
            tee: () => [ReadableStream<{}>, ReadableStream<{}>];
          };

          type ReadableStream<string> = {
            cancel: (reason: any) => Promise<undefined>;
            getReader: () => ReadableStreamDefaultReader<string>;
            locked: false | true;
            pipeThrough: (
              transform: ReadableWritablePair<{}, {}>,
              options: StreamPipeOptions
            ) => ReadableStream<{}>;
            pipeTo: (
              destination: WritableStream<{}>,
              options: StreamPipeOptions
            ) => Promise<undefined>;
            tee: () => [ReadableStream<string>, ReadableStream<string>];
          };

          type ReadableStreamDefaultReader<T> = {
            cancel: (reason: any) => Promise<undefined>;
            closed: Promise<undefined>;
            read: () => Promise<
              | ReadableStreamDefaultReadDoneResult
              | ReadableStreamDefaultReadValueResult<{}>
            >;
            releaseLock: () => undefined;
          };

          type ReadableStreamDefaultReader<string> = {
            cancel: (reason: any) => Promise<undefined>;
            closed: Promise<undefined>;
            read: () => Promise<
              | ReadableStreamDefaultReadDoneResult
              | ReadableStreamDefaultReadValueResult<string>
            >;
            releaseLock: () => undefined;
          };

          type ReadableWritablePair<T, R> = {
            readable: ReadableStream<{}>;
            writable: WritableStream<{}>;
          };

          type StreamPipeOptions = {
            preventAbort: false | true;
            preventCancel: false | true;
            preventClose: false | true;
            signal: AbortSignal;
          };

          type WritableStream<R> = {
            abort: (reason: any) => Promise<undefined>;
            close: () => Promise<undefined>;
            getWriter: () => WritableStreamDefaultWriter<{}>;
            locked: false | true;
          };

          type WritableStreamDefaultWriter<R> = {
            abort: (reason: any) => Promise<undefined>;
            close: () => Promise<undefined>;
            closed: Promise<undefined>;
            desiredSize: number;
            ready: Promise<undefined>;
            releaseLock: () => undefined;
            write: (chunk: {}) => Promise<undefined>;
          };

          ReadableStream<string>;
          "
        `);

        function testNode(name: string) {
          const nodes = findIdentifiers(sourceFile, name);
          const type = checker.getTypeAtLocation(nodes[0]);
          return printSchema(evaluateSchema(nodes[0], checker));
        }
      });
    });
  });
});
