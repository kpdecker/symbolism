import { mockProgram } from "@symbolism/test";
import {
  findIdentifiers,
  findNodesInTree,
  invariantNode,
} from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import { getNodeSchema } from "../value-eval";
import { evaluateSchema } from "../schema";
import { LogLevel, setLogLevel } from "@symbolism/utils";
import ts from "typescript";
import invariant from "tiny-invariant";
import { dumpNode } from "@symbolism/ts-debug";

function testType(source: string, name = "Type") {
  const program = mockProgram({
    "test.tsx": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.tsx")!;
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

const { sourceFile, context } = testType(`
  import React, { ReactNode } from 'react';
  import styled from '@emotion/styled';

  const SimpleTemplate = styled.div\`
    color: red;
  \`;

  const GenericTemplate = styled.div<{ myProp: number }>\`
    color: red;
    \${({ myProp }) => myProp}
  \`;


  const foo = (
    <div>{bar}</div>
  );

  function Bar() {
    return <></>;
  }

  const bat = { Bar };

  export function MyComponent() {
    return (
      <soup>
        food
        <SimpleTemplate />
        {foo}
        <GenericTemplate myProp={1} {...bat} ignore-prop />
        <bat.Bar myProp={2} />
      </soup>
    );
  }

  export function WithInlineProps({ children }: { children: ReactNode; }) {
    return <>
      {bat && children}
      <WithAnyProps anyProp />
    </>;
  }

  export function WithAnyProps({ anyProp }) {
    return <>{anyProp}</>;
  }
`);

describe("type schema converter", () => {
  describe("jsx", () => {
    it("should jsx elements to a schema", () => {
      const jsxElementNodes = findNodesInTree(sourceFile, ts.isJsxElement);
      const { root: jsxSchema } = evaluateSchema(
        jsxElementNodes[0],
        context.checker
      );
      invariant(jsxSchema?.kind === "object");
      expect(Object.keys(jsxSchema.properties)).toMatchInlineSnapshot(`
        Array [
          "ref",
          "key",
          "defaultChecked",
          "defaultValue",
          "suppressContentEditableWarning",
          "suppressHydrationWarning",
          "accessKey",
          "className",
          "contentEditable",
          "contextMenu",
          "dir",
          "draggable",
          "hidden",
          "id",
          "lang",
          "placeholder",
          "slot",
          "spellCheck",
          "style",
          "tabIndex",
          "title",
          "translate",
          "radioGroup",
          "role",
          "about",
          "datatype",
          "inlist",
          "prefix",
          "property",
          "resource",
          "typeof",
          "vocab",
          "autoCapitalize",
          "autoCorrect",
          "autoSave",
          "color",
          "itemProp",
          "itemScope",
          "itemType",
          "itemID",
          "itemRef",
          "results",
          "security",
          "unselectable",
          "inputMode",
          "is",
          "aria-activedescendant",
          "aria-atomic",
          "aria-autocomplete",
          "aria-busy",
          "aria-checked",
          "aria-colcount",
          "aria-colindex",
          "aria-colspan",
          "aria-controls",
          "aria-current",
          "aria-describedby",
          "aria-details",
          "aria-disabled",
          "aria-dropeffect",
          "aria-errormessage",
          "aria-expanded",
          "aria-flowto",
          "aria-grabbed",
          "aria-haspopup",
          "aria-hidden",
          "aria-invalid",
          "aria-keyshortcuts",
          "aria-label",
          "aria-labelledby",
          "aria-level",
          "aria-live",
          "aria-modal",
          "aria-multiline",
          "aria-multiselectable",
          "aria-orientation",
          "aria-owns",
          "aria-placeholder",
          "aria-posinset",
          "aria-pressed",
          "aria-readonly",
          "aria-relevant",
          "aria-required",
          "aria-roledescription",
          "aria-rowcount",
          "aria-rowindex",
          "aria-rowspan",
          "aria-selected",
          "aria-setsize",
          "aria-sort",
          "aria-valuemax",
          "aria-valuemin",
          "aria-valuenow",
          "aria-valuetext",
          "children",
          "dangerouslySetInnerHTML",
          "onCopy",
          "onCopyCapture",
          "onCut",
          "onCutCapture",
          "onPaste",
          "onPasteCapture",
          "onCompositionEnd",
          "onCompositionEndCapture",
          "onCompositionStart",
          "onCompositionStartCapture",
          "onCompositionUpdate",
          "onCompositionUpdateCapture",
          "onFocus",
          "onFocusCapture",
          "onBlur",
          "onBlurCapture",
          "onChange",
          "onChangeCapture",
          "onBeforeInput",
          "onBeforeInputCapture",
          "onInput",
          "onInputCapture",
          "onReset",
          "onResetCapture",
          "onSubmit",
          "onSubmitCapture",
          "onInvalid",
          "onInvalidCapture",
          "onLoad",
          "onLoadCapture",
          "onError",
          "onErrorCapture",
          "onKeyDown",
          "onKeyDownCapture",
          "onKeyPress",
          "onKeyPressCapture",
          "onKeyUp",
          "onKeyUpCapture",
          "onAbort",
          "onAbortCapture",
          "onCanPlay",
          "onCanPlayCapture",
          "onCanPlayThrough",
          "onCanPlayThroughCapture",
          "onDurationChange",
          "onDurationChangeCapture",
          "onEmptied",
          "onEmptiedCapture",
          "onEncrypted",
          "onEncryptedCapture",
          "onEnded",
          "onEndedCapture",
          "onLoadedData",
          "onLoadedDataCapture",
          "onLoadedMetadata",
          "onLoadedMetadataCapture",
          "onLoadStart",
          "onLoadStartCapture",
          "onPause",
          "onPauseCapture",
          "onPlay",
          "onPlayCapture",
          "onPlaying",
          "onPlayingCapture",
          "onProgress",
          "onProgressCapture",
          "onRateChange",
          "onRateChangeCapture",
          "onSeeked",
          "onSeekedCapture",
          "onSeeking",
          "onSeekingCapture",
          "onStalled",
          "onStalledCapture",
          "onSuspend",
          "onSuspendCapture",
          "onTimeUpdate",
          "onTimeUpdateCapture",
          "onVolumeChange",
          "onVolumeChangeCapture",
          "onWaiting",
          "onWaitingCapture",
          "onAuxClick",
          "onAuxClickCapture",
          "onClick",
          "onClickCapture",
          "onContextMenu",
          "onContextMenuCapture",
          "onDoubleClick",
          "onDoubleClickCapture",
          "onDrag",
          "onDragCapture",
          "onDragEnd",
          "onDragEndCapture",
          "onDragEnter",
          "onDragEnterCapture",
          "onDragExit",
          "onDragExitCapture",
          "onDragLeave",
          "onDragLeaveCapture",
          "onDragOver",
          "onDragOverCapture",
          "onDragStart",
          "onDragStartCapture",
          "onDrop",
          "onDropCapture",
          "onMouseDown",
          "onMouseDownCapture",
          "onMouseEnter",
          "onMouseLeave",
          "onMouseMove",
          "onMouseMoveCapture",
          "onMouseOut",
          "onMouseOutCapture",
          "onMouseOver",
          "onMouseOverCapture",
          "onMouseUp",
          "onMouseUpCapture",
          "onSelect",
          "onSelectCapture",
          "onTouchCancel",
          "onTouchCancelCapture",
          "onTouchEnd",
          "onTouchEndCapture",
          "onTouchMove",
          "onTouchMoveCapture",
          "onTouchStart",
          "onTouchStartCapture",
          "onPointerDown",
          "onPointerDownCapture",
          "onPointerMove",
          "onPointerMoveCapture",
          "onPointerUp",
          "onPointerUpCapture",
          "onPointerCancel",
          "onPointerCancelCapture",
          "onPointerEnter",
          "onPointerEnterCapture",
          "onPointerLeave",
          "onPointerLeaveCapture",
          "onPointerOver",
          "onPointerOverCapture",
          "onPointerOut",
          "onPointerOutCapture",
          "onGotPointerCapture",
          "onGotPointerCaptureCapture",
          "onLostPointerCapture",
          "onLostPointerCaptureCapture",
          "onScroll",
          "onScrollCapture",
          "onWheel",
          "onWheelCapture",
          "onAnimationStart",
          "onAnimationStartCapture",
          "onAnimationEnd",
          "onAnimationEndCapture",
          "onAnimationIteration",
          "onAnimationIterationCapture",
          "onTransitionEnd",
          "onTransitionEndCapture",
        ]
      `);
    });
    it("should evaluate fragments", () => {
      const jsxNodes = findNodesInTree(sourceFile, ts.isJsxFragment);
      const jsxSchema = evaluateSchema(jsxNodes[0], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "{
          key: number | string;
          props: any;
          type: any;
        };
        "
      `);
    });
    it("should evaluate jsx text", () => {
      let jsxNodes = findNodesInTree(sourceFile, ts.isJsxText);
      let jsxSchema = evaluateSchema(jsxNodes[0], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "\\"\\\\n        food\\\\n        \\";
        "
      `);
      jsxSchema = evaluateSchema(jsxNodes[1], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "\\"\\\\n        \\";
        "
      `);
    });
    it.skip("should evaluate jsx expressions", () => {
      let jsxNodes = findNodesInTree(sourceFile, ts.isJsxExpression);
      let jsxSchema = evaluateSchema(jsxNodes[0], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "any;
        "
      `);

      jsxSchema = evaluateSchema(jsxNodes[1], context.checker);
      invariant(jsxSchema?.root?.kind === "object");

      expect(Object.keys(jsxSchema.root.properties)).toMatchInlineSnapshot(`
        Array [
          "ref",
          "key",
          "defaultChecked",
          "defaultValue",
          "suppressContentEditableWarning",
          "suppressHydrationWarning",
          "accessKey",
          "className",
          "contentEditable",
          "contextMenu",
          "dir",
          "draggable",
          "hidden",
          "id",
          "lang",
          "placeholder",
          "slot",
          "spellCheck",
          "style",
          "tabIndex",
          "title",
          "translate",
          "radioGroup",
          "role",
          "about",
          "datatype",
          "inlist",
          "prefix",
          "property",
          "resource",
          "typeof",
          "vocab",
          "autoCapitalize",
          "autoCorrect",
          "autoSave",
          "color",
          "itemProp",
          "itemScope",
          "itemType",
          "itemID",
          "itemRef",
          "results",
          "security",
          "unselectable",
          "inputMode",
          "is",
          "aria-activedescendant",
          "aria-atomic",
          "aria-autocomplete",
          "aria-busy",
          "aria-checked",
          "aria-colcount",
          "aria-colindex",
          "aria-colspan",
          "aria-controls",
          "aria-current",
          "aria-describedby",
          "aria-details",
          "aria-disabled",
          "aria-dropeffect",
          "aria-errormessage",
          "aria-expanded",
          "aria-flowto",
          "aria-grabbed",
          "aria-haspopup",
          "aria-hidden",
          "aria-invalid",
          "aria-keyshortcuts",
          "aria-label",
          "aria-labelledby",
          "aria-level",
          "aria-live",
          "aria-modal",
          "aria-multiline",
          "aria-multiselectable",
          "aria-orientation",
          "aria-owns",
          "aria-placeholder",
          "aria-posinset",
          "aria-pressed",
          "aria-readonly",
          "aria-relevant",
          "aria-required",
          "aria-roledescription",
          "aria-rowcount",
          "aria-rowindex",
          "aria-rowspan",
          "aria-selected",
          "aria-setsize",
          "aria-sort",
          "aria-valuemax",
          "aria-valuemin",
          "aria-valuenow",
          "aria-valuetext",
          "children",
          "dangerouslySetInnerHTML",
          "onCopy",
          "onCopyCapture",
          "onCut",
          "onCutCapture",
          "onPaste",
          "onPasteCapture",
          "onCompositionEnd",
          "onCompositionEndCapture",
          "onCompositionStart",
          "onCompositionStartCapture",
          "onCompositionUpdate",
          "onCompositionUpdateCapture",
          "onFocus",
          "onFocusCapture",
          "onBlur",
          "onBlurCapture",
          "onChange",
          "onChangeCapture",
          "onBeforeInput",
          "onBeforeInputCapture",
          "onInput",
          "onInputCapture",
          "onReset",
          "onResetCapture",
          "onSubmit",
          "onSubmitCapture",
          "onInvalid",
          "onInvalidCapture",
          "onLoad",
          "onLoadCapture",
          "onError",
          "onErrorCapture",
          "onKeyDown",
          "onKeyDownCapture",
          "onKeyPress",
          "onKeyPressCapture",
          "onKeyUp",
          "onKeyUpCapture",
          "onAbort",
          "onAbortCapture",
          "onCanPlay",
          "onCanPlayCapture",
          "onCanPlayThrough",
          "onCanPlayThroughCapture",
          "onDurationChange",
          "onDurationChangeCapture",
          "onEmptied",
          "onEmptiedCapture",
          "onEncrypted",
          "onEncryptedCapture",
          "onEnded",
          "onEndedCapture",
          "onLoadedData",
          "onLoadedDataCapture",
          "onLoadedMetadata",
          "onLoadedMetadataCapture",
          "onLoadStart",
          "onLoadStartCapture",
          "onPause",
          "onPauseCapture",
          "onPlay",
          "onPlayCapture",
          "onPlaying",
          "onPlayingCapture",
          "onProgress",
          "onProgressCapture",
          "onRateChange",
          "onRateChangeCapture",
          "onSeeked",
          "onSeekedCapture",
          "onSeeking",
          "onSeekingCapture",
          "onStalled",
          "onStalledCapture",
          "onSuspend",
          "onSuspendCapture",
          "onTimeUpdate",
          "onTimeUpdateCapture",
          "onVolumeChange",
          "onVolumeChangeCapture",
          "onWaiting",
          "onWaitingCapture",
          "onAuxClick",
          "onAuxClickCapture",
          "onClick",
          "onClickCapture",
          "onContextMenu",
          "onContextMenuCapture",
          "onDoubleClick",
          "onDoubleClickCapture",
          "onDrag",
          "onDragCapture",
          "onDragEnd",
          "onDragEndCapture",
          "onDragEnter",
          "onDragEnterCapture",
          "onDragExit",
          "onDragExitCapture",
          "onDragLeave",
          "onDragLeaveCapture",
          "onDragOver",
          "onDragOverCapture",
          "onDragStart",
          "onDragStartCapture",
          "onDrop",
          "onDropCapture",
          "onMouseDown",
          "onMouseDownCapture",
          "onMouseEnter",
          "onMouseLeave",
          "onMouseMove",
          "onMouseMoveCapture",
          "onMouseOut",
          "onMouseOutCapture",
          "onMouseOver",
          "onMouseOverCapture",
          "onMouseUp",
          "onMouseUpCapture",
          "onSelect",
          "onSelectCapture",
          "onTouchCancel",
          "onTouchCancelCapture",
          "onTouchEnd",
          "onTouchEndCapture",
          "onTouchMove",
          "onTouchMoveCapture",
          "onTouchStart",
          "onTouchStartCapture",
          "onPointerDown",
          "onPointerDownCapture",
          "onPointerMove",
          "onPointerMoveCapture",
          "onPointerUp",
          "onPointerUpCapture",
          "onPointerCancel",
          "onPointerCancelCapture",
          "onPointerEnter",
          "onPointerEnterCapture",
          "onPointerLeave",
          "onPointerLeaveCapture",
          "onPointerOver",
          "onPointerOverCapture",
          "onPointerOut",
          "onPointerOutCapture",
          "onGotPointerCapture",
          "onGotPointerCaptureCapture",
          "onLostPointerCapture",
          "onLostPointerCaptureCapture",
          "onScroll",
          "onScrollCapture",
          "onWheel",
          "onWheelCapture",
          "onAnimationStart",
          "onAnimationStartCapture",
          "onAnimationEnd",
          "onAnimationEndCapture",
          "onAnimationIteration",
          "onAnimationIterationCapture",
          "onTransitionEnd",
          "onTransitionEndCapture",
        ]
      `);

      jsxSchema = evaluateSchema(jsxNodes[2], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "1;
        "
      `);
    });

    it("should evaluate jsx attributes", () => {
      let jsxNodes = findNodesInTree(sourceFile, ts.isJsxAttributes);
      let jsxSchema = evaluateSchema(jsxNodes[0], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "{};
        "
      `);

      jsxSchema = evaluateSchema(jsxNodes[1], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "{};
        "
      `);

      jsxSchema = evaluateSchema(jsxNodes[2], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "{};
        "
      `);

      jsxSchema = evaluateSchema(jsxNodes[3], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "type Element = {
          key: number | string;
          props: any;
          type: any;
        };

        {
          Bar: () => Element;
          \\"ignore-prop\\": true;
          myProp: 1;
        };
        "
      `);

      jsxSchema = evaluateSchema(jsxNodes[4], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "{ myProp: 2 };
        "
      `);

      jsxSchema = evaluateSchema(jsxNodes[5], context.checker);
      expect(printSchema(jsxSchema)).toMatchInlineSnapshot(`
        "{ anyProp: true };
        "
      `);
    });
  });
});
