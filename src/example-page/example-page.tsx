import { Renderer } from "@k8slens/extensions";
import path from "path";
import React from "react";

const {
  K8sApi: { configMapApi, nodesApi, deploymentApi, podsApi },
  Component: {
    Checkbox,
    Input,
    Table,
    TableRow,
    TableCell,
    TableHead,
    TabLayout,
    Tabs,
    Tab,
  },
} = Renderer;

type ConfigMap = Renderer.K8sApi.ConfigMap;
type Node = Renderer.K8sApi.Node;
type Deployment = Renderer.K8sApi.Deployment;
type Pod = Renderer.K8sApi.Pod;

export function ExampleIcon(props: Renderer.Component.IconProps) {
  return (
    <Renderer.Component.Icon
      {...props}
      material="support_agent"
      tooltip={path.basename(__filename)}
    />
  );
}

type State = {
  config: ConfigMap | null;
  deployment: Deployment | null;
  nodes: Record<string, Node>;
  pods: Record<string, Pod>;
  activeTab: number;
};

export class ExamplePage extends React.Component<
  { extension: Renderer.LensExtension },
  State
> {
  state: State = {
    config: null,
    deployment: null,
    nodes: {},
    pods: {},
    activeTab: 0,
  };

  private configWatcher: any;
  private deploymentWatcher: any;
  private nodesWatcher: any;
  private podsWatcher: any;

  async componentDidMount() {
    // TODO Manual fetch and watch is wasteful. Investigate catalogs
    const config = await configMapApi.get({
      name: "ci-resources",
      namespace: "jenkins-scheduler",
    });
    this.setState((prev) => ({
      ...prev,
      config,
    }));

    this.configWatcher = configMapApi.watch({
      namespace: "jenkins-scheduler",
      callback: (data) => {
        console.log("config map data", data);
        if (data) {
          const config = data.object as any as ConfigMap;
          if (config.metadata.name === "ci-resources") {
            this.setState((prev) => ({
              ...prev,
              config,
            }));
          }
        }
      },
    });

    const nodesList = await nodesApi.list();
    const nodes = nodesList.reduce(
      (collection, node) => ({
        ...collection,
        [node.metadata.name]: node,
      }),
      {}
    );
    this.setState((prev) => ({
      ...prev,
      nodes,
    }));

    this.nodesWatcher = nodesApi.watch({
      callback: (data) => {
        console.log("nodes data", data);
        if (data) {
          const node = data.object as any as Node;
          this.setState((prev) => ({
            ...prev,
            nodes: {
              ...prev.nodes,
              [node.metadata.name]: node,
            } as any,
          }));
        }
      },
    });

    const podsList = await podsApi.list({ namespace: "jenkins" });
    const pods = podsList.reduce(
      (collection, pod) => ({
        ...collection,
        [pod.metadata.name]: pod,
      }),
      {}
    );
    this.setState((prev) => ({
      ...prev,
      pods,
    }));

    this.podsWatcher = podsApi.watch({
      namespace: "jenkins",
      callback: (data) => {
        console.log("pods data", data);
        if (data) {
          const pod = data.object as any as Pod;
          this.setState((prev) => ({
            ...prev,
            pods: {
              ...prev.pods,
              [pod.metadata.name]: pod,
            } as any,
          }));
        }
      },
    });

    const deployment = await deploymentApi.get({
      name: "kube0",
      namespace: "buildkit",
    });
    this.setState((prev) => ({
      ...prev,
      deployment,
    }));

    this.deploymentWatcher = deploymentApi.watch({
      namespace: "buildkit",
      callback: (data) => {
        console.log("deployment data", data);
        if (data) {
          const deployment = data.object as any as Deployment;
          if (deployment.metadata.name === "kube0") {
            this.setState((prev) => ({
              ...prev,
              deployment,
            }));
          }
        }
      },
    });
  }

  async componentWillUnmount() {
    if (this.configWatcher) this.configWatcher();
    if (this.deploymentWatcher) this.deploymentWatcher();
    if (this.nodesWatcher) this.nodesWatcher();
    if (this.podsWatcher) this.podsWatcher();
  }

  async onToggleNodeLabel(node: Node, label: string, addLabel: boolean) {
    console.log(
      `Toggle node ${node.metadata.name} label ${label} to ${addLabel}`
    );

    const result = await nodesApi.patch(
      { name: node.metadata.name },
      {
        metadata: {
          labels: {
            ...node.metadata.labels,
            [label]: addLabel ? "" : null,
          },
        },
      }
    );

    console.log(result);
  }

  async onUpdateConfig(field: string, value: string) {
    console.log(`Update config ${field} to ${value}`);

    const result = await configMapApi.patch(
      { name: "ci-resources", namespace: "jenkins-scheduler" },
      {
        data: {
          [field]: value,
        },
      }
    );

    console.log(result);
  }

  async onUpdateBuildKitDeployments(replicas: string) {
    console.log(`Update buildkit deployment ${replicas}`);

    const result = await deploymentApi.patch(
      { name: "kube0", namespace: "buildkit" },
      {
        spec: {
          replicas: parseInt(replicas),
        },
      }
    );

    console.log(result);
  }

  async onUpdateJenkinsResources(node: Node, resources: string) {
    console.log(`Update node ${node.metadata.name} resources ${resources}`);

    const result = await nodesApi.patch(
      { name: node.metadata.name },
      {
        metadata: {
          labels: {
            ...node.metadata.labels,
            "scheduler/jenkins": resources,
          },
        },
      }
    );

    console.log(result);
  }

  getPodResourceCost(podName: string, e2eResource: string, prResource: string) {
    const isE2E = podName.includes("e2e");
    return (isE2E ? parseInt(e2eResource) : parseInt(prResource));
  }

  render() {
    const { activeTab } = this.state;
    
    const nodes = Object.values(this.state.nodes);
    const pods = Object.values(this.state.pods);
    const e2eResource = this.state.config?.data?.["e2e-resource"];
    const prResource = this.state.config?.data?.["pr-resource"];

    const available = nodes.reduce(
      (sum, node) =>
        sum + parseInt(node.metadata.labels?.["scheduler/jenkins"]),
      0
    );
    const used = pods.filter(pod => !!pod.spec.nodeName).reduce((sum, pod) => 
      sum + this.getPodResourceCost(pod.metadata.name, e2eResource, prResource)
    , 0);

    return (
      <TabLayout>
        <div className="flex column gaps" style={{ height: "100%" }}>
          <div
            style={{
              background: "var(--contentColor)",
              padding: "calc(var(--margin)*2)",
            }}
          >
            <h4>Cluster resources - {`v(${process.env.npm_package_version})`}</h4>

            <div>
              <p>
                Available: <i>{available}</i>
              </p>
              <p>
                Used: <i>{used}</i>
              </p>
            </div>
          </div>

          {/* <div style={{ background: "var(--contentColor)" }}>
            <div>{JSON.stringify(this.deployment)}</div>
          </div> */}

          <div
            className="flex column gaps"
            style={{
              background: "var(--contentColor)",
              padding: "calc(var(--margin)*2)",
            }}
          >
            <h5>Resources</h5>

            <div>
              <p>E2E</p>
              <Input
                name="e2e-resource"
                value={e2eResource}
                onChange={(value) => this.onUpdateConfig("e2e-resource", value)}
              />
            </div>

            <div>
              <p>PR</p>
              <Input
                name="pr-resource"
                value={prResource}
                onChange={(value) => this.onUpdateConfig("pr-resource", value)}
              />
            </div>

            <div>
              <p>Buildkit</p>
              <Input
                name="buildkit-resource"
                value={String(this.state.deployment?.spec?.replicas)}
                onChange={(value) => this.onUpdateBuildKitDeployments(value)}
              />
            </div>
          </div>

          <div
            className="flex column gaps"
            style={{
              background: "var(--contentColor)",
              padding: "calc(var(--margin)*2)",
              flex: 1,
              overflow: "auto",
            }}
          >
            <Tabs
              scrollable
              value={activeTab}
              onChange={(tabIndex) => this.setState({ activeTab: tabIndex })}
            >
              <Tab label="Nodes" value={0} />
              <Tab label="Pods" value={1} />
            </Tabs>

            {activeTab === 0 && (
              <Table>
                <TableHead>
                  <TableCell>Node</TableCell>
                  <TableCell>Resources</TableCell>
                  <TableCell>BuildKit</TableCell>
                  <TableCell>Jenkins worker</TableCell>
                  <TableCell>Jenkins runner</TableCell>
                  <TableCell>AoIP</TableCell>
                  <TableCell>Hosting</TableCell>
                </TableHead>

                {nodes.map((node) => (
                  <TableRow key={node.metadata.name} nowrap>
                    <TableCell>{node.metadata.name}</TableCell>
                    <TableCell>
                      <Input
                        value={node.metadata.labels?.["scheduler/jenkins"]}
                        onChange={(val) =>
                          this.onUpdateJenkinsResources(node, val)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        label="Enabled"
                        value={"docker/buildkit" in node.metadata.labels}
                        onChange={(val) =>
                          this.onToggleNodeLabel(node, "docker/buildkit", val)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        label="Enabled"
                        value={"jenkins/worker" in node.metadata.labels}
                        onChange={(val) =>
                          this.onToggleNodeLabel(node, "jenkins/worker", val)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        label="Enabled"
                        value={"jenkins/runner" in node.metadata.labels}
                        onChange={(val) =>
                          this.onToggleNodeLabel(node, "jenkins/runner", val)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        label="Enabled"
                        value={"supports/aoip-networking" in node.metadata.labels}
                        onChange={(val) =>
                          this.onToggleNodeLabel(node, "supports/aoip-networking", val)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        label="Enabled"
                        value={"node-role.kubernetes.io/hosting" in node.metadata.labels}
                        onChange={(val) =>
                          this.onToggleNodeLabel(node, "node-role.kubernetes.io/hosting", val)
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
            {activeTab === 1 && (
              <Table>
                <TableHead>
                  <TableCell>Pod</TableCell>
                  <TableCell>Resources</TableCell>
                  <TableCell>Node</TableCell>
                </TableHead>

                {pods.map((pod) => (
                  <TableRow key={pod.metadata.name} nowrap>
                    <TableCell>{pod.metadata.name}</TableCell>
                    <TableCell>
                      <i>{this.getPodResourceCost(pod.metadata.name, e2eResource, prResource)}</i>
                    </TableCell>
                    <TableCell>{pod.spec.nodeName}</TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        </div>
      </TabLayout>
    );
  }
}
