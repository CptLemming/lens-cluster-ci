import React from "react";
import { Renderer } from "@k8slens/extensions";
import { ExampleIcon, ExamplePage } from "./src/example-page/example-page"
import { ExamplePodDetails } from "./src/example-page/example-pod-details"

/**
 * 
 * RendererExtension which extends LensRendererExtension runs in Lens' 'renderer' process (NOT 'main' process)
 * main vs renderer <https://www.electronjs.org/docs/tutorial/quick-start#main-and-renderer-processes>
 * 
 * LensRendererExtension is the interface to Lens' renderer process. Its api allows you to access, configure, 
 * and customize Lens data add custom Lens UI elements, and generally run custom code in Lens' renderer process.
 *
 * To see console statements in 'renderer' process, go to the console tab in DevTools in Lens
 * View > Toggle Developer Tools > Console.
 * 
 */
export default class OciImageExtensionRenderer extends Renderer.LensExtension {
  /**
   * onActivate is called when your extension has been successfully enabled.
   */
  async onActivate() {
    console.log("activated");
  }

  clusterPageMenus = [
    {
      target: { pageId: "jenkins-resources" },
      title: "Jenkins Resources",
      components: {
        Icon: ExampleIcon,
      }
    }
  ]

  clusterPages = [
    {
      id: "jenkins-resources",
      components: {
        Page: () => <ExamplePage extension={this}/>,
      }
    }
  ]

  kubeObjectDetailItems = [
    {
      kind: "Pod",
      apiVersions: ["v1"],
      priority: 10,
      components: {
        Details: (props: Renderer.Component.KubeObjectDetailsProps<Renderer.K8sApi.Pod>) => <ExamplePodDetails {...props} />
      }
    }
  ]
}
